import { describe, expect, it } from "vitest";
import {
  clientMatchesQuery,
  filterClientsByQuery,
  foldSearchText,
  looksLikeDocumentQuery,
  nameFilterAttempts,
  nameSearchTokens,
  responseLooksUnfiltered,
  wisproDocumentSearchQuery,
  wisproNameSearchQuery,
} from "./wispro-client-search";

const client = (
  name: string,
  national_identification_number: string | null = null,
) => ({ name, national_identification_number });

describe("foldSearchText", () => {
  it("strips accents", () => {
    expect(foldSearchText("Ángel Prín")).toBe("angel prin");
  });
});

describe("nameSearchTokens", () => {
  it("keeps words of two or more characters", () => {
    expect(nameSearchTokens("ANGEL PRIN")).toEqual(["angel", "prin"]);
    expect(nameSearchTokens("Ángel  J.")).toEqual(["angel"]);
  });
});

describe("looksLikeDocumentQuery", () => {
  it("accepts cédula and RIF with optional prefix", () => {
    expect(looksLikeDocumentQuery("27015967")).toBe(true);
    expect(looksLikeDocumentQuery("V-27.015.967")).toBe(true);
    expect(looksLikeDocumentQuery("J123456789")).toBe(true);
  });

  it("rejects names and short fragments", () => {
    expect(looksLikeDocumentQuery("ANGEL PRIN")).toBe(false);
    expect(looksLikeDocumentQuery("ANGEL 27015967")).toBe(false);
    expect(looksLikeDocumentQuery("1234")).toBe(false);
  });
});

describe("nameFilterAttempts", () => {
  it("sends the full query, then the longest token and the surname", () => {
    expect(nameFilterAttempts("ANGEL PRIN")).toEqual([
      "angel prin",
      "angel",
      "prin",
    ]);
    expect(nameFilterAttempts("ANGEL")).toEqual(["angel"]);
  });
});

describe("wispro search params", () => {
  it("uses the official Wispro client filters", () => {
    expect(wisproNameSearchQuery("Gutierrez")).toEqual({
      name_unaccent_cont: "Gutierrez",
    });
    expect(wisproDocumentSearchQuery("V-27.015.967")).toEqual({
      national_identification_number_eq: "27015967",
    });
  });
});

describe("clientMatchesQuery", () => {
  it("requires every name token", () => {
    expect(clientMatchesQuery(client("ANGEL DAVID PRIN"), "angel prin")).toBe(
      true,
    );
    expect(clientMatchesQuery(client("KLEIVER ZERPA"), "ANGEL PRIN")).toBe(
      false,
    );
    expect(clientMatchesQuery(client("JONATHAN MARCANO"), "ANGEL PRIN")).toBe(
      false,
    );
  });

  it("matches cédula with or without V prefix", () => {
    expect(clientMatchesQuery(client("ANGEL PRIN", "V27015967"), "27015967")).toBe(
      true,
    );
    expect(clientMatchesQuery(client("ANGEL PRIN", "27015967"), "V-27.015.967")).toBe(
      true,
    );
    expect(clientMatchesQuery(client("KLEIVER ZERPA", "V11111111"), "27015967")).toBe(
      false,
    );
  });
});

describe("filterClientsByQuery", () => {
  const page = [
    client("KLEIVER ZERPA", "V111"),
    client("JONATHAN MARCANO", "V222"),
    client("YONATHAN SUAREZ", "V333"),
    client("ANGEL PRIN", "V27015967"),
  ];

  it("drops the unfiltered first page when the name does not match", () => {
    expect(filterClientsByQuery(page.slice(0, 3), "ANGEL PRIN")).toEqual([]);
  });

  it("keeps the matching client", () => {
    expect(filterClientsByQuery(page, "angel prin").map((item) => item.name)).toEqual(
      ["ANGEL PRIN"],
    );
  });
});

describe("responseLooksUnfiltered", () => {
  it("detects when Wispro ignored the name filter", () => {
    expect(
      responseLooksUnfiltered(
        [client("KLEIVER ZERPA"), client("JONATHAN MARCANO")],
        "angel",
      ),
    ).toBe(true);
    expect(
      responseLooksUnfiltered([client("ANGEL DAVID"), client("ANGEL PRIN")], "angel"),
    ).toBe(false);
  });
});
