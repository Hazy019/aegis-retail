import React from 'react';

interface BrandLogoProps {
  size?: number;
  withContainer?: boolean;
  className?: string;
}

export function BrandLogo({ size = 44, withContainer = true, className = '' }: BrandLogoProps) {
  const imageElement = (
    <img
      src="/Aegis-retails_logo.png"
      alt="Aegis Retail Logo"
      width={size}
      height={size}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
        imageRendering: '-webkit-optimize-contrast'
      }}
    />
  );

  if (!withContainer) {
    return <div className={className}>{imageElement}</div>;
  }

  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--tint-primary-5)',
        border: '1px solid var(--tint-primary-15)',
        padding: '6px',
        borderRadius: 'var(--radius-md)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-subtle)'
      }}
    >
      {imageElement}
    </div>
  );
}
