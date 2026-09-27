import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildBankTransferInstruction,
  buildVietQrImageUrl,
  readBankTransferConfig,
} from "@/modules/payments/bank-transfer";

const account = {
  accountName: "NGUYEN VAN A",
  accountNo: "0123456789",
  bankId: "970436",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("bank transfer checkout option", () => {
  it("stays hidden while the deployment has no receiving account", () => {
    vi.stubEnv("BANK_TRANSFER_BANK_ID", "");
    vi.stubEnv("BANK_TRANSFER_ACCOUNT_NO", "");
    vi.stubEnv("BANK_TRANSFER_ACCOUNT_NAME", "");

    expect(readBankTransferConfig()).toBeNull();
    expect(
      buildBankTransferInstruction({
        amountVnd: 230_000,
        config: readBankTransferConfig(),
        orderNumber: "MB-1CD39059E3D48C785FAD",
      }),
    ).toBeNull();
  });

  it("refuses a partial account configuration", () => {
    vi.stubEnv("BANK_TRANSFER_BANK_ID", "970436");
    vi.stubEnv("BANK_TRANSFER_ACCOUNT_NO", "");
    vi.stubEnv("BANK_TRANSFER_ACCOUNT_NAME", "NGUYEN VAN A");

    expect(readBankTransferConfig()).toBeNull();
  });

  it("resolves the configured account once every key is present", () => {
    vi.stubEnv("BANK_TRANSFER_BANK_ID", ` ${account.bankId} `);
    vi.stubEnv("BANK_TRANSFER_ACCOUNT_NO", account.accountNo);
    vi.stubEnv("BANK_TRANSFER_ACCOUNT_NAME", account.accountName);

    expect(readBankTransferConfig()).toEqual(account);
  });

  it("builds the VietQR image URL from the account and the order", () => {
    expect(
      buildVietQrImageUrl({
        ...account,
        amountVnd: 230_000,
        transferContent: "MB-1CD39059E3D48C785FAD",
      }),
    ).toBe(
      "https://img.vietqr.io/image/970436-0123456789-compact2.png?amount=230000&addInfo=MB-1CD39059E3D48C785FAD&accountName=NGUYEN+VAN+A",
    );
  });

  it("escapes an account holder name that would otherwise break the query", () => {
    const url = buildVietQrImageUrl({
      accountName: "Nguyễn Văn A & B",
      accountNo: "0123456789",
      bankId: "970436",
      amountVnd: 1,
      transferContent: "MB-X",
    });

    expect(url).toContain("accountName=Nguy%E1%BB%85n+V%C4%83n+A+%26+B");
    expect(url.split("?")[0]).toBe(
      "https://img.vietqr.io/image/970436-0123456789-compact2.png",
    );
  });

  it("hands the customer the amount, the account and the order number", () => {
    const instruction = buildBankTransferInstruction({
      amountVnd: 230_000,
      config: account,
      orderNumber: "MB-1CD39059E3D48C785FAD",
    });

    expect(instruction).toEqual({
      ...account,
      amountVnd: 230_000,
      orderNumber: "MB-1CD39059E3D48C785FAD",
      transferContent: "MB-1CD39059E3D48C785FAD",
      qrImageUrl:
        "https://img.vietqr.io/image/970436-0123456789-compact2.png?amount=230000&addInfo=MB-1CD39059E3D48C785FAD&accountName=NGUYEN+VAN+A",
    });
  });
});
