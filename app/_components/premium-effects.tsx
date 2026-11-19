"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { parseCollectionItem } from "@/lib/premium-collections";
import "../premium-collections.css";
const EffectContext = createContext("none");
const particleSymbols: Record<string, string> = { samurai: "❀", pirate: "◆" };

export function PremiumEffectProvider({
  effectId,
  children,
}: Readonly<{
  effectId: string;
  children: ReactNode;
}>) {
  return <EffectContext.Provider value={effectId}>{children}</EffectContext.Provider>;
}
export function VictoryEffect({ won, previewId }: Readonly<{ won: boolean; previewId?: string }>) {
  const equipped = useContext(EffectContext),
    id = previewId ?? equipped;
  const product = parseCollectionItem(id),
    [show, setShow] = useState(false);
  useEffect(() => {
    if (!won || !product) {
      setShow(false);
      return;
    }
    setShow(true);
    const timer = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(timer);
  }, [won, id]);
  if (!show || product?.kind !== "effect") return null;
  const particle = particleSymbols[product.collection.id] ?? "✦";
  return (
    <div className={`premium-victory premium-victory-${product.collection.id}`} aria-hidden="true">
      <span className="premium-victory-emblem">{product.collection.symbol}</span>
      {Array.from({ length: 16 }, (_, i) => (
        <span
          className="premium-victory-particle"
          key={i}
          style={
            {
              "--particle-angle": `${i * 22.5}deg`,
              "--particle-delay": `${i * 30}ms`,
            } as React.CSSProperties
          }
        >
          {particle}
        </span>
      ))}
    </div>
  );
}
