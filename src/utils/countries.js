// ISO-3166 alpha-2 → { name, currency } for the countries we realistically
// import tours for. Used to resolve a vendor's bare country code (e.g. "GB",
// "FR") into the name + currency our Country records require. Unknown codes
// return null so callers can fall back (e.g. to the tour's own price currency).
const COUNTRIES = {
    AE: { name: 'United Arab Emirates', currency: 'AED' },
    AR: { name: 'Argentina', currency: 'ARS' },
    AT: { name: 'Austria', currency: 'EUR' },
    AU: { name: 'Australia', currency: 'AUD' },
    BE: { name: 'Belgium', currency: 'EUR' },
    BR: { name: 'Brazil', currency: 'BRL' },
    CA: { name: 'Canada', currency: 'CAD' },
    CH: { name: 'Switzerland', currency: 'CHF' },
    CL: { name: 'Chile', currency: 'CLP' },
    CN: { name: 'China', currency: 'CNY' },
    CO: { name: 'Colombia', currency: 'COP' },
    CZ: { name: 'Czechia', currency: 'CZK' },
    DE: { name: 'Germany', currency: 'EUR' },
    DK: { name: 'Denmark', currency: 'DKK' },
    EG: { name: 'Egypt', currency: 'EGP' },
    ES: { name: 'Spain', currency: 'EUR' },
    FI: { name: 'Finland', currency: 'EUR' },
    FR: { name: 'France', currency: 'EUR' },
    GB: { name: 'United Kingdom', currency: 'GBP' },
    GR: { name: 'Greece', currency: 'EUR' },
    HK: { name: 'Hong Kong', currency: 'HKD' },
    HR: { name: 'Croatia', currency: 'EUR' },
    HU: { name: 'Hungary', currency: 'HUF' },
    ID: { name: 'Indonesia', currency: 'IDR' },
    IE: { name: 'Ireland', currency: 'EUR' },
    IL: { name: 'Israel', currency: 'ILS' },
    IN: { name: 'India', currency: 'INR' },
    IS: { name: 'Iceland', currency: 'ISK' },
    IT: { name: 'Italy', currency: 'EUR' },
    JP: { name: 'Japan', currency: 'JPY' },
    KR: { name: 'South Korea', currency: 'KRW' },
    MA: { name: 'Morocco', currency: 'MAD' },
    MX: { name: 'Mexico', currency: 'MXN' },
    MY: { name: 'Malaysia', currency: 'MYR' },
    NL: { name: 'Netherlands', currency: 'EUR' },
    NO: { name: 'Norway', currency: 'NOK' },
    NZ: { name: 'New Zealand', currency: 'NZD' },
    PE: { name: 'Peru', currency: 'PEN' },
    PH: { name: 'Philippines', currency: 'PHP' },
    PL: { name: 'Poland', currency: 'PLN' },
    PT: { name: 'Portugal', currency: 'EUR' },
    QA: { name: 'Qatar', currency: 'QAR' },
    RO: { name: 'Romania', currency: 'RON' },
    SA: { name: 'Saudi Arabia', currency: 'SAR' },
    SE: { name: 'Sweden', currency: 'SEK' },
    SG: { name: 'Singapore', currency: 'SGD' },
    TH: { name: 'Thailand', currency: 'THB' },
    TR: { name: 'Türkiye', currency: 'TRY' },
    TW: { name: 'Taiwan', currency: 'TWD' },
    US: { name: 'United States', currency: 'USD' },
    VN: { name: 'Vietnam', currency: 'VND' },
    ZA: { name: 'South Africa', currency: 'ZAR' },
};

// Accepts an ISO alpha-2 code (case-insensitive). Returns
// { code, name, currency } or null if unknown.
export function resolveCountry(code) {
    const key = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(key)) return null;
    const match = COUNTRIES[key];
    if (!match) return null;
    return { code: key, name: match.name, currency: match.currency };
}
