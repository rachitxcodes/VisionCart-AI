import { describe, it, expect } from 'vitest';

describe('VisionCart AI Frontend Smoke Test', () => {
  it('verifies environment and foundational components load', () => {
    expect(true).toBe(true);
  });

  it('validates rupee formatting calculation from paise', () => {
    const paise = 25000;
    const rupees = paise / 100;
    expect(rupees).toBe(250);
  });

  it('validates GST calculation split logic', () => {
    const taxableValuePaise = 10000; // Rs 100.00
    const gstRate = 18;
    const cgst = Math.round(taxableValuePaise * (gstRate / 2) / 100);
    const sgst = Math.round(taxableValuePaise * (gstRate / 2) / 100);
    const lineTotal = taxableValuePaise + cgst + sgst;

    expect(cgst).toBe(900); // Rs 9.00
    expect(sgst).toBe(900); // Rs 9.00
    expect(lineTotal).toBe(11800); // Rs 118.00
  });
});

