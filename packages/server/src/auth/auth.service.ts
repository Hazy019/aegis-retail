import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { verifyDeviceSignature } from '@aegis/core';
import type { AegisRepository } from '../db/repository.js';
import type { Role } from '@aegis/core';

export interface TokenPayload {
  store_id: string;
  role: Role;
  device_id?: string;
  user_id?: string;
  username?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // in seconds (e.g. 900 for 15 min)
}

export class AuthService {
  private repo: AegisRepository;
  private jwtSecret: string;
  private accessTokenTtlSec: number = 15 * 60; // 15 minutes
  private refreshTokenTtlDays: number = 7; // 7 days
  private failedLoginAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();

  constructor(
    repo: AegisRepository,
    jwtSecret: string = process.env.JWT_SECRET || 'aegis_super_secret_jwt_key_development_2026'
  ) {
    this.repo = repo;
    this.jwtSecret = jwtSecret;
  }

  /**
   * Cashier Device Login using asymmetric device certificate signature.
   */
  async loginDevice(
    deviceId: string,
    signature: string,
    timestamp: string,
    _appVersion?: string
  ): Promise<AuthTokens> {
    const device = await this.repo.getDevice(deviceId);
    if (!device) {
      throw new Error('Device not found or not registered');
    }

    if (device.is_revoked) {
      throw new Error('device_revoked');
    }

    // Verify clock skew (reject if timestamp drift > 10 minutes)
    const clientTime = new Date(timestamp).getTime();
    const serverTime = Date.now();
    if (Math.abs(serverTime - clientTime) > 10 * 60 * 1000) {
      throw new Error('Clock skew detected. Check device time.');
    }

    // Verify cryptographic signature over payload `${deviceId}:${timestamp}`
    const payloadToVerify = `${deviceId}:${timestamp}`;
    const isValid = verifyDeviceSignature(
      device.device_cert_public_key,
      payloadToVerify,
      signature
    );
    if (!isValid) {
      throw new Error('Invalid cryptographic device signature');
    }

    const tokenPayload: TokenPayload = {
      store_id: device.store_id,
      role: 'cashier',
      device_id: device.id
    };

    return this.generateTokenPair(tokenPayload, undefined, device.id);
  }

  /**
   * Manager Login with Password & TOTP MFA with Rate Limiting / Brute-force Protection.
   */
  async loginManager(
    email: string,
    passwordPlain: string,
    totpCode?: string
  ): Promise<AuthTokens> {
    const normalizedEmail = email.toLowerCase().trim();
    const attempt = this.failedLoginAttempts.get(normalizedEmail);

    if (attempt && attempt.lockedUntil > Date.now()) {
      const waitSec = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
      throw new Error(`Account temporarily locked due to excessive failed attempts. Try again in ${waitSec}s.`);
    }

    const recordFailedAttempt = () => {
      const current = (attempt ? attempt.count : 0) + 1;
      if (current >= 5) {
        this.failedLoginAttempts.set(normalizedEmail, {
          count: current,
          lockedUntil: Date.now() + 15 * 60 * 1000 // 15 min lock
        });
      } else {
        this.failedLoginAttempts.set(normalizedEmail, {
          count: current,
          lockedUntil: 0
        });
      }
    };

    const user = await this.repo.getUserByEmail(normalizedEmail);
    if (!user || !user.is_active || user.role !== 'manager') {
      recordFailedAttempt();
      throw new Error('Invalid manager credentials');
    }

    if (user.password_hash) {
      const isPasswordValid = await bcrypt.compare(passwordPlain, user.password_hash);
      if (!isPasswordValid) {
        recordFailedAttempt();
        throw new Error('Invalid manager credentials');
      }
    }

    // Verify TOTP MFA if enabled
    if (user.mfa_enabled) {
      if (!totpCode) {
        throw new Error('MFA code required');
      }
      if (user.mfa_secret && !authenticator.check(totpCode, user.mfa_secret)) {
        recordFailedAttempt();
        throw new Error('Invalid MFA token');
      }
    }

    // Login successful: reset lockout counter
    this.failedLoginAttempts.delete(normalizedEmail);

    const tokenPayload: TokenPayload = {
      store_id: user.store_id,
      role: 'manager',
      user_id: user.id,
      username: user.username
    };

    return this.generateTokenPair(tokenPayload, user.id, undefined);
  }

  /**
   * Refresh token rotation with reuse detection.
   */
  async refreshAccessToken(oldRefreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(oldRefreshToken);
    const record = await this.repo.getRefreshToken(tokenHash);

    if (!record) {
      throw new Error('Invalid refresh token');
    }

    // Token reuse detection: if a revoked token is presented, compromise is assumed
    if (record.isRevoked) {
      await this.repo.revokeTokenFamily(record.familyId);
      throw new Error('Refresh token reuse detected. Family revoked.');
    }

    if (new Date() > new Date(record.expiresAt)) {
      throw new Error('Refresh token expired');
    }

    // Mark current token as used/revoked
    record.isRevoked = true;

    // Check device revocation if this was a device token
    if (record.deviceId) {
      const device = await this.repo.getDevice(record.deviceId);
      if (!device || device.is_revoked) {
        throw new Error('device_revoked');
      }
    }

    // Determine payload
    let payload: TokenPayload;
    if (record.deviceId) {
      const device = await this.repo.getDevice(record.deviceId);
      payload = {
        store_id: device!.store_id,
        role: 'cashier',
        device_id: device!.id
      };
    } else {
      const user = await this.repo.getUserById(record.userId!);
      payload = {
        store_id: user!.store_id,
        role: user!.role,
        user_id: user!.id,
        username: user!.username
      };
    }

    // Generate new token pair within the same token family
    return this.generateTokenPair(payload, record.userId, record.deviceId, record.familyId);
  }

  /**
   * Verifies an access token and returns the typed payload.
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  private async generateTokenPair(
    payload: TokenPayload,
    userId?: string,
    deviceId?: string,
    existingFamilyId?: string
  ): Promise<AuthTokens> {
    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenTtlSec
    });

    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const familyId = existingFamilyId || crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000
    ).toISOString();

    await this.repo.saveRefreshToken({
      userId,
      deviceId,
      tokenHash,
      familyId,
      expiresAt
    });

    return {
      access_token: accessToken,
      refresh_token: rawRefreshToken,
      expires_in: this.accessTokenTtlSec
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
