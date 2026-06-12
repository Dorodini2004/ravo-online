"use client";

import Image from "next/image";
import type { Card } from "@/types/room";

type CardImageProps = {
  card?: Card;
  className?: string;
  faceDown?: boolean;
};

export function getCardImageSrc(card?: Card, faceDown = false) {
  if (faceDown || !card) {
    return "/cards/rueckseite.png";
  }

  if (card.type === "number") {
    return `/cards/${card.value}.png`;
  }

  if (card.type === "ravo-joker") {
    return "/cards/joker.png";
  }

  return "/cards/bluff.png";
}

export function getCardAlt(card?: Card, faceDown = false) {
  if (faceDown || !card) {
    return "Face-down RAVO card";
  }

  if (card.type === "number") {
    return `RAVO number ${card.value} card`;
  }

  if (card.type === "ravo-joker") {
    return "RAVO Joker card";
  }

  return "BLUFF card";
}

export function CardImage({ card, className = "", faceDown = false }: CardImageProps) {
  const imagePath = getCardImageSrc(card, faceDown);
  const shouldLogRevealPath =
    className.includes("ravo-center-revealed-card") ||
    className.includes("ravo-reveal-face") ||
    className.includes("ravo-table-card");

  if (shouldLogRevealPath) {
    console.log("revealed image path:", imagePath);
  }

  return (
    <Image
      src={imagePath}
      alt={getCardAlt(card, faceDown)}
      draggable={false}
      width={512}
      height={768}
      sizes="(max-width: 640px) 112px, 144px"
      suppressHydrationWarning
      className={`select-none rounded-[0.9rem] object-cover shadow-[0_18px_50px_rgba(0,0,0,0.55)] ${className}`}
    />
  );
}
