import "../wallet-balances.css";

function CurrencyMark({ premium }: { premium: boolean }) {
  return premium ? (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6 4h12l4 6-10 11L2 10z"
        fill="#ac76fa"
        stroke="#eedaff"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M2 10h20M6 4l2 6 4 11 4-11 2-6M8 10l4-6 4 6"
        fill="none"
        stroke="#522791"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M16 1v4m-2-2h4" stroke="#fff4ff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="#f7b745" stroke="#ffeaac" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="7.7" fill="#ffd36c" stroke="#9c5713" strokeWidth="1" />
      <path
        d="M7.5 7.5h9v9h-9zM10.5 7.5v9m3-9v9m-6-6h9m-9 3h9"
        fill="none"
        stroke="#71400d"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M8 8h2v2H8zm6 3h2v2h-2zm-3 3h2v2h-2z" fill="#71400d" />
    </svg>
  );
}

export function WalletBalances({
  coins,
  gems,
  locale,
  openShop,
}: Readonly<{
  coins?: number;
  gems?: number;
  locale: string;
  openShop: () => void;
}>) {
  const format = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  return (
    <div className="header-wallet">
      {[
        { name: "Sudokoins", value: coins, premium: false },
        { name: "Sudogemmes", value: gems, premium: true },
      ].map(({ name, value, premium }) => {
        const full = value === undefined ? "—" : format.format(value);
        const shown = value !== undefined && value >= 100_000 ? compact.format(value) : full;
        const label = `${name} : ${full}`;
        return (
          <button
            key={name}
            type="button"
            className={premium ? "wallet-gems" : "wallet-coins"}
            aria-label={label}
            title={label}
            onClick={openShop}
          >
            <CurrencyMark premium={premium} />
            <span>{shown}</span>
          </button>
        );
      })}
    </div>
  );
}
