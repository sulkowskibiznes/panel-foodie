import { describe, expect, it } from "vitest";
import { czyLinkDoFolderu, rozpoznajLinkDysku } from "@/lib/drive/linki";

describe("linki do Dysku (SPEC rozdz. 13.1)", () => {
  it("rozpoznaje wszystkie spotykane formaty adresu", () => {
    expect(rozpoznajLinkDysku("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz")).toMatchObject({ rodzaj: "folder", id: "1AbCdEfGhIjKlMnOpQrStUvWxYz" });
    expect(rozpoznajLinkDysku("https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz?usp=sharing")).toMatchObject({ rodzaj: "folder", id: "1AbCdEfGhIjKlMnOpQrStUvWxYz" });
    expect(rozpoznajLinkDysku("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz")).toMatchObject({ rodzaj: "nieznany", id: "1AbCdEfGhIjKlMnOpQrStUvWxYz" });
    expect(rozpoznajLinkDysku("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=drive_link")).toMatchObject({ rodzaj: "plik", id: "1AbCdEfGhIjKlMnOpQrStUvWxYz" });
    expect(rozpoznajLinkDysku("  https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz  ")).not.toBeNull();
  });

  it("odrzuca cudze hosty, http i śmieci", () => {
    expect(rozpoznajLinkDysku("https://example.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz")).toBeNull();
    expect(rozpoznajLinkDysku("http://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz")).toBeNull();
    expect(rozpoznajLinkDysku("content 5 mies")).toBeNull();
    expect(rozpoznajLinkDysku("")).toBeNull();
    expect(rozpoznajLinkDysku(null)).toBeNull();
    expect(rozpoznajLinkDysku("https://drive.google.com/drive/folders/krotki")).toBeNull();
  });

  it("do kreatora pakietu wchodzą foldery i ?id=, nie pojedyncze pliki", () => {
    expect(czyLinkDoFolderu(rozpoznajLinkDysku("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz"))).toBe(true);
    expect(czyLinkDoFolderu(rozpoznajLinkDysku("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz"))).toBe(true);
    expect(czyLinkDoFolderu(rozpoznajLinkDysku("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view"))).toBe(false);
    expect(czyLinkDoFolderu(null)).toBe(false);
  });
});
