import { redirect } from "next/navigation";

/** „Ustawienia" w nawigacji prowadzi do pierwszej zakładki. */
export default function Ustawienia() {
  redirect("/zespol/ustawienia/zespol");
}
