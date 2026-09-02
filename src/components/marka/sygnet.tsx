import Image from "next/image";
import { copy } from "@/lib/copy";

type Props = {
  wariant?: "fiolet" | "bialy";
  rozmiar?: number;
  className?: string;
};

/** Sygnet Foodie Media. Fioletowy na jasnym tle, biały na ciemnym. Statyczny SVG, więc bez optymalizacji. */
export function Sygnet({ wariant = "fiolet", rozmiar = 40, className }: Props) {
  const src = wariant === "fiolet" ? "/sygnet-fiolet.svg" : "/sygnet-bialy.svg";
  return (
    <Image
      src={src}
      alt={copy.marka.nazwa}
      width={rozmiar}
      height={rozmiar}
      unoptimized
      priority
      className={className}
    />
  );
}
