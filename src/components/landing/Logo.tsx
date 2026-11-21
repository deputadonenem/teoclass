import React from "react";
import Image from "next/image";

export function Logo({
  variant = "dark",
  className = "",
  size = "header",
}: {
  variant?: "dark" | "light";
  className?: string;
  size?: "header" | "footer" | "large";
}) {
  const isDark = variant === "dark";
  const src = isDark ? "/img/logoh.png" : "/img/logot.png";

  const sizeClasses =
    size === "footer"
      ? "h-14 sm:h-16 w-auto"
      : size === "large"
      ? "h-16 sm:h-20 w-auto"
      : "h-12 sm:h-14 w-auto";

  return (
    <div className={`flex items-center select-none ${className}`}>
      <Image
        src={src}
        alt="TeoClass — Gestão Acadêmica e EAD para Escolas Teológicas"
        width={2172}
        height={724}
        priority={isDark}
        className={`${sizeClasses} object-contain transition-all`}
      />
    </div>
  );
}
