import Link from "next/link";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <Link className="brand-link" href="/" translate="no">
      <span aria-hidden="true" className="capture-mark" />
      <span className="brand-wordmark">
        <strong>MasterBall</strong>
        {compact ? null : <small>Store TCG</small>}
      </span>
    </Link>
  );
}
