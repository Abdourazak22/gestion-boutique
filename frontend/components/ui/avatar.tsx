import { initiales } from "@/lib/format";

const teintes = [
  "bg-brand-100 text-brand-700",
  "bg-[#e6eefb] text-[#1c5cab]",
  "bg-[#fdeee7] text-[#9a4a23]",
  "bg-[#f1ecfb] text-[#4a3aa7]",
];

export function Avatar({
  nom,
  taille = "md",
}: {
  nom: string;
  taille?: "sm" | "md";
}) {
  const index =
    [...nom].reduce((somme, c) => somme + c.charCodeAt(0), 0) % teintes.length;
  const dimension = taille === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dimension} ${teintes[index]}`}
      aria-hidden="true"
    >
      {initiales(nom)}
    </span>
  );
}
