import { useState, useEffect, useMemo } from "react";

/* ================================================================
   JABULANI RELIFE — TRADE-IN VALUE CALCULATOR
   ----------------------------------------------------------------
   HOW TO UPDATE PRICES (for Afeez / Yasir):
   All numbers below are PLACEHOLDER supplier cost prices in Naira.
   Replace them with your real vendor cost for a clean UK-used unit.
   The calculator does everything else automatically.

   FORMULA:
   Trade-in = supplierCost × BASE_RATE × conditionMultiplier
              − (sum of issue deductions, as % of that amount)
   Result is rounded DOWN to the nearest ₦5,000.
   ================================================================ */

const BASE_RATE = 0.75; // We offer 75% of supplier cost for a perfect unit

/* FX ADJUSTMENT — when the dollar rate changes, update CURRENT_USD_RATE
   only. Every price in the catalog reprices automatically, because all
   catalog values were converted at the N1,390 baseline. */
const BASELINE_USD_RATE = 1390; // rate used when catalog was built - don't touch
const CURRENT_USD_RATE = 1390; // <-- UPDATE THIS when the rate changes
const FX = CURRENT_USD_RATE / BASELINE_USD_RATE;
const ESIM_ONLY_DEDUCTION = 0.1; // US eSIM-only iPhones (14+) resell lower here
const CARRIER_LOCK_DEDUCTION = 0.35; // carrier-locked phones can't use Nigerian SIMs

// SIM question only applies to iPhone 14 and newer (Apple's eSIM-only era)
const isEsimEra = (brand, model) => {
    if (brand !== "iPhone" || !model) return false;
    if (model.includes("Air")) return false; // Air is eSIM-only worldwide - no question needed
    const m = model.match(/^iPhone (\d+)/);
    return m ? parseInt(m[1], 10) >= 14 : false;
};

const CONDITIONS = [
    {
        id: "excellent",
        label: "Excellent",
        mult: 1.0,
        desc: "Looks almost new. No marks you can see at arm's length.",
    },
    {
        id: "good",
        label: "Good",
        mult: 0.92,
        desc: "Light scratches or wear, but fully clean and presentable.",
    },
    {
        id: "rough",
        label: "Rough",
        mult: 0.78,
        desc: "Visible scratches, scuffs or wear all over the body.",
    },
];

const ISSUES = [
    { id: "battery", label: "Battery health below 85%", pct: 0.08 },
    { id: "screen_crack", label: "Cracked or replaced screen", pct: 0.15 },
    { id: "screen_scratch", label: "Deep scratches on screen", pct: 0.06 },
    { id: "camera", label: "Faulty camera (front or back)", pct: 0.1 },
    { id: "biometrics", label: "Face ID / fingerprint not working", pct: 0.1 },
    { id: "body", label: "Dents or cracked back glass", pct: 0.07 },
    { id: "audio_charge", label: "Speaker, mic or charging fault", pct: 0.08 },
];

// Extra checks shown only for foldables (Z Fold / Z Flip)
const FOLD_ISSUES = [
    {
        id: "fold_inner",
        label: "Inner screen: dead pixels, lines or crease damage",
        pct: 0.2,
    },
    {
        id: "fold_protector",
        label: "Inner screen protector peeling or bubbling",
        pct: 0.05,
    },
    {
        id: "fold_hinge",
        label: "Hinge loose, stiff or doesn't stay open",
        pct: 0.12,
    },
];

const ALL_ISSUES = [...ISSUES, ...FOLD_ISSUES];
const isFoldable = (model) =>
    !!model && (model.includes("Fold") || model.includes("Flip"));

// Costs merged from suppliers. Precedence on overlaps: Mobi King > Smart Areena > Circle.
// Costs merged from suppliers. Precedence: purchase invoices > Mobi King > Smart Areena > Circle.
//  - Purchase invoices 17/06/26 (China, actual transacted): RMB x N215.5
//  - Mobi King Phones FZCO Dubai (Grade A): AED x N378.75 (USD1 = N1,390 / 3.67)
//  - Smart Areena Phones LLC (clean tested, 3mo warranty): AED x N378.75
//  - FJ Device 29/06/26 (UK used, Grade A/A+ non-boosted, 90d warranty): AED x N378.75
//  - Circle Stock 09/07 (UK, best grade per model): GBP x N1,876.50 (1.35 USD x N1,390)
//  - Apple ASIS list (used, active stock with box): USD x N1,390 (P-SIM prices as base)
//  - Local NGN lists 11/07/26: 15/16/17 series incl. 15 Pro, 16 Pro, 16e, 17 Air
//    (16 Plus & 16e = eSIM prices as base; 15 Pro 256 derived from new-unit price)
const CATALOG = {
    iPhone: [
        { name: "iPhone X", storages: { "64GB": 84000, "256GB": 103000 } },
        { name: "iPhone XS", storages: { "64GB": 131000 } },
        {
            name: "iPhone XS Max",
            storages: { "64GB": 141000, "256GB": 216000 },
        },
        {
            name: "iPhone XR",
            storages: { "64GB": 165000, "128GB": 201000, "256GB": 208000 },
        },
        {
            name: "iPhone SE (2nd Gen)",
            storages: { "64GB": 90000, "128GB": 113000, "256GB": 122000 },
        },
        {
            name: "iPhone SE (3rd Gen)",
            storages: { "64GB": 145000, "128GB": 163000 },
        },
        {
            name: "iPhone 11",
            storages: { "64GB": 201000, "128GB": 229000, "256GB": 235000 },
        },
        {
            name: "iPhone 11 Pro",
            storages: { "64GB": 244000, "256GB": 273000 },
        },
        {
            name: "iPhone 11 Pro Max",
            storages: { "64GB": 258000, "256GB": 299000, "512GB": 328000 },
        },
        {
            name: "iPhone 12",
            storages: { "64GB": 225000, "128GB": 261000, "256GB": 272000 },
        },
        { name: "iPhone 12 Mini", storages: { "64GB": 150000 } },
        {
            name: "iPhone 12 Pro",
            storages: { "128GB": 341000, "256GB": 369000, "512GB": 383000 },
        },
        {
            name: "iPhone 12 Pro Max",
            storages: { "128GB": 403000, "256GB": 437000 },
        },
        { name: "iPhone 13", storages: { "128GB": 333000, "256GB": 356000 } },
        {
            name: "iPhone 13 Mini",
            storages: { "64GB": 272000, "128GB": 272000, "256GB": 300000 },
        },
        {
            name: "iPhone 13 Pro",
            storages: { "128GB": 460000, "256GB": 502000, "512GB": 515000 },
        },
        {
            name: "iPhone 13 Pro Max",
            storages: { "128GB": 557000, "256GB": 612000, "512GB": 625000 },
        },
        { name: "iPhone 14", storages: { "128GB": 390000 } },
        { name: "iPhone 14 Plus", storages: { "128GB": 424000 } },
        {
            name: "iPhone 14 Pro",
            storages: { "128GB": 612000, "256GB": 653000 },
        },
        {
            name: "iPhone 14 Pro Max",
            storages: { "128GB": 716000, "256GB": 752000, "512GB": 765000 },
        },
        { name: "iPhone 15", storages: { "128GB": 544000, "256GB": 550000 } },
        {
            name: "iPhone 15 Plus",
            storages: { "128GB": 591000, "512GB": 700000 },
        },
        {
            name: "iPhone 15 Pro",
            storages: { "128GB": 685000, "256GB": 725000 },
        },
        {
            name: "iPhone 15 Pro Max",
            storages: { "256GB": 850000, "512GB": 966000 },
        },
        {
            name: "iPhone 16",
            storages: { "128GB": 705000, "256GB": 850000, "512GB": 950000 },
        },
        { name: "iPhone 16e", storages: { "128GB": 400000 } },
        {
            name: "iPhone 16 Plus",
            storages: { "128GB": 725000, "256GB": 825000, "512GB": 950000 },
        },
        {
            name: "iPhone 16 Pro",
            storages: { "128GB": 895000, "512GB": 1023000 },
        },
        {
            name: "iPhone 16 Pro Max",
            storages: { "256GB": 1050000, "1TB": 1280000 },
        },
        { name: "iPhone 17", storages: { "256GB": 955000, "512GB": 1100000 } },
        { name: "iPhone 17 Air", storages: { "256GB": 1000000 } },
        {
            name: "iPhone 17 Pro",
            storages: { "256GB": 1508000, "512GB": 1612000 },
        },
        { name: "iPhone 17 Pro Max", storages: { "256GB": 1661000 } },
    ],
    Samsung: [
        { name: "Galaxy A16", storages: { "128GB": 129000 } },
        { name: "Galaxy A17", storages: { "128GB": 178000 } },
        { name: "Galaxy S20", storages: { "128GB": 129000 } },
        {
            name: "Galaxy S20 FE",
            storages: { "64GB": 150000, "128GB": 150000 },
        },
        { name: "Galaxy S20 Plus", storages: { "128GB": 160000 } },
        { name: "Galaxy S21", storages: { "128GB": 209000, "256GB": 222000 } },
        { name: "Galaxy S21 FE", storages: { "128GB": 206000 } },
        { name: "Galaxy S21 Plus", storages: { "128GB": 209000 } },
        { name: "Galaxy S21 Ultra", storages: { "128GB": 280000 } },
        { name: "Galaxy S22", storages: { "128GB": 241000, "256GB": 267000 } },
        {
            name: "Galaxy S22 Plus",
            storages: { "128GB": 225000, "256GB": 244000 },
        },
        { name: "Galaxy S22 Ultra", storages: { "128GB": 300000 } },
        { name: "Galaxy S23", storages: { "256GB": 281000 } },
        { name: "Galaxy S23 FE", storages: { "128GB": 291000 } },
        { name: "Galaxy S23 Plus", storages: { "256GB": 300000 } },
        {
            name: "Galaxy S23 Ultra",
            storages: { "256GB": 554000, "512GB": 554000 },
        },
        { name: "Galaxy S24", storages: { "128GB": 413000, "256GB": 413000 } },
        {
            name: "Galaxy S24 FE",
            storages: { "128GB": 403000, "256GB": 460000 },
        },
        { name: "Galaxy S25", storages: { "128GB": 619000, "256GB": 676000 } },
        { name: "Galaxy S25 FE", storages: { "128GB": 610000 } },
        { name: "Galaxy S25 Plus", storages: { "256GB": 704000 } },
        { name: "Galaxy S25 Edge", storages: { "256GB": 938000 } },
        { name: "Galaxy A32 5G", storages: { "64GB": 99000 } },
        { name: "Galaxy A33 5G", storages: { "128GB": 160000 } },
        { name: "Galaxy A34 5G", storages: { "128GB": 178000 } },
        { name: "Galaxy A52s 5G", storages: { "128GB": 141000 } },
        { name: "Galaxy A54 5G", storages: { "128GB": 178000 } },
        { name: "Galaxy A73 5G", storages: { "128GB": 235000 } },
        { name: "Galaxy Z Fold 5", storages: { "256GB": 625000 } },
    ],
    Pixel: [
        { name: "Pixel 6", storages: { "128GB": 192000, "256GB": 215000 } },
        { name: "Pixel 6a", storages: { "128GB": 207000 } },
        { name: "Pixel 7", storages: { "128GB": 239000, "256GB": 280000 } },
        {
            name: "Pixel 7 Pro",
            storages: { "128GB": 356000, "256GB": 377000, "512GB": 402000 },
        },
        { name: "Pixel 8", storages: { "128GB": 327000, "256GB": 366000 } },
        { name: "Pixel 8 Pro", storages: { "128GB": 442000, "256GB": 485000 } },
        { name: "Pixel 9 Pro", storages: { "256GB": 711000 } },
        { name: "Pixel 9 Pro XL", storages: { "256GB": 711000 } },
        { name: "Pixel 10 Pro", storages: { "256GB": 970000 } },
        { name: "Pixel 10 Pro XL", storages: { "256GB": 981000 } },
    ],
};

const RED = "#CA2A1E";
const RED_HOT = "#E8402F";
const BG = "#0C0908";
const PANEL = "#161110";
const LINE_C = "#2A211D";
const INK_LIGHT = "#F4EDE6";
const MUTED = "#A08F82";

// Official Jabulani Express lines - anything different is not us.
// Leads rotate across SALES_LINES automatically.
const SALES_LINES = [
    "2347040119765",
    "2348149166290",
    "2349169986803",
    "2349038895069",
    "2349169986792",
    "2349169986797",
];
const OFFICIAL_LINES = [
    { num: "0704 011 9765", role: "Sales", wa: "2347040119765" },
    { num: "0814 916 6290", role: "Sales", wa: "2348149166290" },
    { num: "0916 998 6792", role: "Sales", wa: "2349169986792" },
    { num: "0916 998 6797", role: "Sales", wa: "2349169986797" },
    { num: "0916 998 6803", role: "Sales", wa: "2349169986803" },
    { num: "0903 889 5069", role: "Sales", wa: "2349038895069" },
    { num: "0916 998 6793", role: "Inventory" },
    { num: "0916 998 6798", role: "Inventory" },
    { num: "0916 998 6804", role: "Finance / Accounts" },
    { num: "0913 400 0803", role: "Logistics" },
];

const TERMS = [
    "Online estimates are indicative only and do not constitute a binding offer. The final trade-in value is determined after physical inspection at our store.",
    "All trade-ins are completed in-store at 2A Olaide Tomori Street, Ikeja (Computer Village). We do not offer home, courier or remote swaps.",
    "Estimates are valid for 48 hours. Market prices and exchange rates move, and values may be revised without notice.",
    "You must be the rightful owner of the device. A valid government-issued ID is required, and IMEIs are verified against blacklist databases. Suspected stolen devices will be declined and may be reported.",
    "iCloud / Google accounts must be fully signed out and activation lock switched off before a swap can be completed.",
    "Multiple devices are welcome and each unit is inspected and valued individually. For 5 or more devices, please message a sales line ahead of your visit.",
    "Back up and erase your personal data before trading in. All accepted devices are wiped, and Jabulani Express is not responsible for data left on a device.",
    "Trade-in value may be taken as cash or as credit toward any purchase in store. Original box and accessories may improve the final offer.",
    "Jabulani Express reserves the right to revise any estimate or decline any trade-in after inspection.",
];

const naira = (n) => "\u20A6" + n.toLocaleString("en-NG");
const roundDown5k = (n) => Math.floor(n / 5000) * 5000;

function useCountUp(target) {
    const [val, setVal] = useState(target ?? 0);
    useEffect(() => {
        if (target == null) return;
        setVal((start) => {
            const diff = target - start;
            if (diff === 0) return start;
            const t0 = performance.now();
            const dur = 500;
            let raf;
            const tick = (t) => {
                const p = Math.min((t - t0) / dur, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                setVal(Math.round(start + diff * eased));
                if (p < 1) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
            return start;
        });
    }, [target]);
    return val;
}

export default function JabulaniReLife() {
    const [brand, setBrand] = useState(null);
    const [model, setModel] = useState(null);
    const [storage, setStorage] = useState(null);
    const [simType, setSimType] = useState(null);
    const [netLock, setNetLock] = useState(null); // 'unlocked' | 'locked'
    const [qty, setQty] = useState(1);
    const [showTerms, setShowTerms] = useState(false);
    const [locked, setLocked] = useState(null);
    const [condition, setCondition] = useState(null);
    const [issues, setIssues] = useState([]);

    useEffect(() => {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href =
            "https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&family=Sora:wght@400;600;700&display=swap";
        document.head.appendChild(link);
        return () => document.head.removeChild(link);
    }, []);

    const modelObj = useMemo(
        () =>
            brand && model
                ? CATALOG[brand].find((m) => m.name === model)
                : null,
        [brand, model],
    );

    const needsSim = isEsimEra(brand, model);

    const estimate = useMemo(() => {
        if (!modelObj || !storage || !condition || locked !== false)
            return null;
        if (isEsimEra(brand, model) && !simType) return null;
        if (!netLock) return null;
        const cost = modelObj.storages[storage] * FX;
        const cond = CONDITIONS.find((c) => c.id === condition);
        const base = cost * BASE_RATE * cond.mult;
        const lockDed = netLock === "locked" ? CARRIER_LOCK_DEDUCTION : 0;
        const simDed =
            isEsimEra(brand, model) && simType === "esim"
                ? ESIM_ONLY_DEDUCTION
                : 0;
        const dedPct = issues.reduce(
            (sum, id) => sum + ALL_ISSUES.find((i) => i.id === id).pct,
            0,
        );
        const value = Math.max(
            base * (1 - dedPct - simDed - lockDed),
            base * 0.2,
        );
        return { value: roundDown5k(value) };
    }, [
        modelObj,
        storage,
        condition,
        issues,
        locked,
        simType,
        netLock,
        brand,
        model,
    ]);

    const shownValue = useCountUp(estimate ? estimate.value * qty : null);

    // Rotate leads across the official sales lines
    const salesLine = useMemo(
        () => SALES_LINES[Math.floor(Math.random() * SALES_LINES.length)],
        [model, storage],
    );

    const toggleIssue = (id) =>
        setIssues((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );

    const reset = () => {
        setBrand(null);
        setModel(null);
        setStorage(null);
        setSimType(null);
        setNetLock(null);
        setLocked(null);
        setCondition(null);
        setIssues([]);
        setQty(1);
    };

    const whatsappLink = () => {
        if (!estimate) return "#";
        const condLabel = CONDITIONS.find((c) => c.id === condition).label;
        const issueList = issues.length
            ? issues
                  .map((id) => ALL_ISSUES.find((i) => i.id === id).label)
                  .join(", ")
            : "None reported";
        const simLine = needsSim
            ? `\nSIM: ${simType === "esim" ? "eSIM only" : "Physical SIM + eSIM"}`
            : "";
        const netLine = `\nNetwork: ${netLock === "locked" ? "Carrier locked" : "Unlocked"}`;
        const qtyLine =
            qty > 1 ? `\nQuantity: ${qty} units (same model & condition)` : "";
        const valueText =
            qty > 1
                ? `${naira(estimate.value * qty)} total (${qty} x ${naira(estimate.value)})`
                : naira(estimate.value);
        const msg = `Hello Jabulani Express! I'd like to trade in my phone.\n\nDevice: ${model} ${storage}${simLine}${netLine}${qtyLine}\nCondition: ${condLabel}\nIssues: ${issueList}\nEstimated value: ${valueText}\n\nPlease confirm my final quote. (via ReLife calculator)`;
        return `https://wa.me/${salesLine}?text=${encodeURIComponent(msg)}`;
    };

    const archivo = { fontFamily: "'Archivo', sans-serif" };
    const sora = { fontFamily: "'Sora', sans-serif" };

    // Progress
    const done = [
        brand,
        model,
        storage,
        ...(needsSim ? [simType] : []),
        netLock,
        locked === false ? "ok" : null,
        condition,
    ].filter(Boolean).length;
    const total = needsSim ? 7 : 6;
    const progress = Math.min(done / total, 1);

    const stepNo = (n) => String(n).padStart(2, "0");

    const Step = ({ n, title, children, sub }) => (
        <section
            className="relative mt-12"
            style={{ animation: "jbFadeUp .5s ease both" }}
        >
            <div className="flex items-baseline gap-3 mb-1">
                <span
                    aria-hidden
                    style={{
                        ...archivo,
                        fontWeight: 900,
                        fontSize: "2.4rem",
                        lineHeight: 1,
                        color: "transparent",
                        WebkitTextStroke: `1.2px ${RED_HOT}`,
                    }}
                >
                    {n}
                </span>
                <h2
                    className="uppercase text-sm font-bold"
                    style={{
                        ...archivo,
                        letterSpacing: "0.18em",
                        color: INK_LIGHT,
                    }}
                >
                    {title}
                </h2>
            </div>
            {sub && (
                <p className="text-sm mb-4" style={{ color: MUTED }}>
                    {sub}
                </p>
            )}
            {!sub && <div className="mb-4" />}
            {children}
        </section>
    );

    const Chip = ({ active, onClick, children }) => (
        <button
            onClick={onClick}
            className="px-4 py-3 rounded-xl border text-sm font-semibold transition-all"
            style={{
                ...sora,
                borderColor: active ? RED_HOT : LINE_C,
                background: active ? RED : "transparent",
                color: active ? "#FFF" : INK_LIGHT,
                boxShadow: active ? "0 0 28px rgba(202,42,30,0.35)" : "none",
            }}
        >
            {children}
        </button>
    );

    return (
        <div
            className="min-h-screen"
            style={{ background: BG, ...sora, color: INK_LIGHT }}
        >
            <style>{`
        @keyframes jbFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes jbGlow { 0%,100% { opacity: .55; } 50% { opacity: .9; } }
      `}</style>

            {/* Progress bar */}
            <div
                className="fixed top-0 left-0 right-0"
                style={{ height: 3, background: "#1B1512", zIndex: 50 }}
            >
                <div
                    style={{
                        height: "100%",
                        width: `${progress * 100}%`,
                        background: `linear-gradient(90deg, ${RED}, ${RED_HOT})`,
                        boxShadow: `0 0 12px ${RED_HOT}`,
                        transition: "width .4s ease",
                    }}
                />
            </div>

            {/* Header */}
            <header className="relative overflow-hidden px-5 pt-12 pb-10">
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(520px 260px at 85% -10%, rgba(202,42,30,0.32), transparent 70%)`,
                        animation: "jbGlow 6s ease-in-out infinite",
                    }}
                />
                <div className="max-w-xl mx-auto relative">
                    <p
                        className="uppercase text-xs mb-3"
                        style={{
                            ...archivo,
                            fontWeight: 800,
                            letterSpacing: "0.34em",
                            color: RED_HOT,
                        }}
                    >
                        Jabulani Express &middot; ReLife
                    </p>
                    <h1
                        style={{
                            ...archivo,
                            fontWeight: 900,
                            fontSize: "clamp(2rem, 8vw, 2.8rem)",
                            lineHeight: 1.05,
                            letterSpacing: "-0.01em",
                        }}
                    >
                        Your phone still
                        <br />
                        has value.
                        <span style={{ color: RED_HOT }}> Claim it.</span>
                    </h1>
                    <p
                        className="text-sm mt-4 max-w-md"
                        style={{ color: MUTED }}
                    >
                        A precise trade-in estimate in under a minute. Take it
                        as cash, or put it toward any device in store.
                    </p>
                </div>
            </header>

            <main className="max-w-xl mx-auto px-5 pb-48">
                <Step n="01" title="Brand">
                    <div className="flex gap-2 flex-wrap">
                        {Object.keys(CATALOG).map((b) => (
                            <Chip
                                key={b}
                                active={brand === b}
                                onClick={() => {
                                    setBrand(b);
                                    setModel(null);
                                    setStorage(null);
                                    setIssues([]);
                                }}
                            >
                                {b}
                            </Chip>
                        ))}
                    </div>
                </Step>

                {brand && (
                    <Step n="02" title="Model">
                        <div className="flex gap-2 flex-wrap">
                            {CATALOG[brand].map((m) => (
                                <Chip
                                    key={m.name}
                                    active={model === m.name}
                                    onClick={() => {
                                        setModel(m.name);
                                        setStorage(null);
                                        setSimType(null);
                                        setNetLock(null);
                                        setIssues([]);
                                        setQty(1);
                                    }}
                                >
                                    {m.name}
                                </Chip>
                            ))}
                        </div>
                    </Step>
                )}

                {modelObj && (
                    <Step n="03" title="Storage">
                        <div className="flex gap-2 flex-wrap">
                            {Object.keys(modelObj.storages).map((s) => (
                                <Chip
                                    key={s}
                                    active={storage === s}
                                    onClick={() => setStorage(s)}
                                >
                                    {s}
                                </Chip>
                            ))}
                        </div>
                    </Step>
                )}

                {storage && needsSim && (
                    <Step
                        n="04"
                        title="SIM type"
                        sub="Check the side of the phone - no SIM tray means it's an eSIM-only (US) unit."
                    >
                        <div className="flex gap-2 flex-wrap">
                            <Chip
                                active={simType === "psim"}
                                onClick={() => setSimType("psim")}
                            >
                                Physical SIM + eSIM
                            </Chip>
                            <Chip
                                active={simType === "esim"}
                                onClick={() => setSimType("esim")}
                            >
                                eSIM only
                            </Chip>
                        </div>
                    </Step>
                )}

                {storage && (!needsSim || simType) && (
                    <Step
                        n={needsSim ? "05" : "04"}
                        title="Network status"
                        sub="Locked phones can't use Nigerian SIMs, so their trade-in value drops sharply. Not sure? Try a different network's SIM."
                    >
                        <div className="flex gap-2 flex-wrap">
                            <Chip
                                active={netLock === "unlocked"}
                                onClick={() => setNetLock("unlocked")}
                            >
                                Unlocked (any SIM works)
                            </Chip>
                            <Chip
                                active={netLock === "locked"}
                                onClick={() => setNetLock("locked")}
                            >
                                Locked to a carrier
                            </Chip>
                        </div>
                    </Step>
                )}

                {storage && (!needsSim || simType) && netLock && (
                    <Step
                        n={needsSim ? "06" : "05"}
                        title={
                            brand === "iPhone"
                                ? "iCloud signed out?"
                                : "Google account removed?"
                        }
                        sub={`We only accept phones with the ${
                            brand === "iPhone"
                                ? "iCloud account"
                                : "Google account"
                        } fully signed out and activation lock off.`}
                    >
                        <div className="flex gap-2">
                            <Chip
                                active={locked === false}
                                onClick={() => setLocked(false)}
                            >
                                Yes, signed out
                            </Chip>
                            <Chip
                                active={locked === true}
                                onClick={() => setLocked(true)}
                            >
                                Not yet
                            </Chip>
                        </div>
                        {locked === true && (
                            <div
                                className="mt-4 p-4 rounded-xl text-sm"
                                style={{
                                    background: "rgba(202,42,30,0.12)",
                                    border: `1px solid rgba(202,42,30,0.4)`,
                                    color: INK_LIGHT,
                                }}
                            >
                                No problem — sign out in Settings (takes about 2
                                minutes), then come back for your quote. Our
                                team can walk you through it on WhatsApp.
                            </div>
                        )}
                    </Step>
                )}

                {locked === false && (
                    <Step n={needsSim ? "07" : "06"} title="Body condition">
                        <div className="space-y-2">
                            {CONDITIONS.map((c) => {
                                const on = condition === c.id;
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => setCondition(c.id)}
                                        className="w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden"
                                        style={{
                                            borderColor: on ? RED_HOT : LINE_C,
                                            background: on
                                                ? "rgba(202,42,30,0.10)"
                                                : PANEL,
                                            boxShadow: on
                                                ? "0 0 28px rgba(202,42,30,0.22)"
                                                : "none",
                                        }}
                                    >
                                        <span
                                            className="absolute left-0 top-0 bottom-0"
                                            style={{
                                                width: 3,
                                                background: on
                                                    ? RED_HOT
                                                    : "transparent",
                                            }}
                                        />
                                        <span
                                            className="block font-bold text-sm uppercase"
                                            style={{
                                                ...archivo,
                                                letterSpacing: "0.08em",
                                                color: on ? RED_HOT : INK_LIGHT,
                                            }}
                                        >
                                            {c.label}
                                        </span>
                                        <span
                                            className="block text-xs mt-1"
                                            style={{ color: MUTED }}
                                        >
                                            {c.desc}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </Step>
                )}

                {condition && locked === false && (
                    <Step
                        n={needsSim ? "08" : "07"}
                        title="Any faults?"
                        sub="Tick all that apply. Nothing wrong? Leave everything unticked."
                    >
                        <div className="space-y-2">
                            {(isFoldable(model) ? ALL_ISSUES : ISSUES).map(
                                (iss) => {
                                    const on = issues.includes(iss.id);
                                    return (
                                        <button
                                            key={iss.id}
                                            onClick={() => toggleIssue(iss.id)}
                                            className="w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all"
                                            style={{
                                                borderColor: on
                                                    ? RED_HOT
                                                    : LINE_C,
                                                background: on
                                                    ? "rgba(202,42,30,0.10)"
                                                    : PANEL,
                                            }}
                                        >
                                            <span
                                                className="rounded-md border flex items-center justify-center flex-shrink-0"
                                                style={{
                                                    width: 20,
                                                    height: 20,
                                                    borderColor: on
                                                        ? RED_HOT
                                                        : "#4A3C34",
                                                    background: on
                                                        ? RED
                                                        : "transparent",
                                                }}
                                            >
                                                {on && (
                                                    <svg
                                                        width="12"
                                                        height="12"
                                                        viewBox="0 0 12 12"
                                                        fill="none"
                                                    >
                                                        <path
                                                            d="M2 6.5L4.5 9L10 3.5"
                                                            stroke="white"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                )}
                                            </span>
                                            <span className="text-sm font-medium">
                                                {iss.label}
                                            </span>
                                        </button>
                                    );
                                },
                            )}
                        </div>
                    </Step>
                )}

                {estimate && (
                    <div
                        className="mt-8 p-4 rounded-xl border flex items-center justify-between gap-4"
                        style={{
                            borderColor: LINE_C,
                            background: PANEL,
                            animation: "jbFadeUp .5s ease both",
                        }}
                    >
                        <div>
                            <p className="text-sm font-semibold">
                                Trading more than one?
                            </p>
                            <p
                                className="text-xs mt-0.5"
                                style={{ color: MUTED }}
                            >
                                Same model &amp; condition only. Different
                                phones? Run separate quotes.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                                onClick={() =>
                                    setQty((q) => Math.max(1, q - 1))
                                }
                                className="rounded-full border font-bold"
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderColor: LINE_C,
                                    color: INK_LIGHT,
                                }}
                            >
                                &minus;
                            </button>
                            <span
                                className="tabular-nums text-lg"
                                style={{
                                    ...archivo,
                                    fontWeight: 900,
                                    minWidth: 20,
                                    textAlign: "center",
                                }}
                            >
                                {qty}
                            </span>
                            <button
                                onClick={() =>
                                    setQty((q) => Math.min(10, q + 1))
                                }
                                className="rounded-full border font-bold"
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderColor: RED_HOT,
                                    color: RED_HOT,
                                }}
                            >
                                +
                            </button>
                        </div>
                    </div>
                )}

                {estimate && (
                    <button
                        onClick={reset}
                        className="mt-10 text-sm font-semibold underline"
                        style={{ color: MUTED }}
                    >
                        Start over with another phone
                    </button>
                )}

                {/* Terms & Conditions */}
                <section
                    className="mt-16 p-5 rounded-2xl border"
                    style={{ borderColor: LINE_C, background: PANEL }}
                >
                    <button
                        onClick={() => setShowTerms((s) => !s)}
                        className="w-full flex items-center justify-between"
                    >
                        <span
                            className="uppercase text-xs"
                            style={{
                                ...archivo,
                                fontWeight: 800,
                                letterSpacing: "0.26em",
                                color: RED_HOT,
                            }}
                        >
                            Terms &amp; Conditions
                        </span>
                        <span
                            style={{
                                ...archivo,
                                fontWeight: 900,
                                fontSize: "1.2rem",
                                color: MUTED,
                            }}
                        >
                            {showTerms ? "\u2212" : "+"}
                        </span>
                    </button>
                    {showTerms && (
                        <ol className="mt-4 space-y-3">
                            {TERMS.map((t, i) => (
                                <li
                                    key={i}
                                    className="flex gap-3 text-xs leading-relaxed"
                                    style={{ color: MUTED }}
                                >
                                    <span
                                        className="flex-shrink-0 tabular-nums"
                                        style={{
                                            ...archivo,
                                            fontWeight: 800,
                                            color: RED_HOT,
                                        }}
                                    >
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <span>{t}</span>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>

                {/* Official lines */}
                <footer
                    className="mt-16 p-5 rounded-2xl border"
                    style={{ borderColor: LINE_C, background: PANEL }}
                >
                    <p
                        className="uppercase text-xs mb-1"
                        style={{
                            ...archivo,
                            fontWeight: 800,
                            letterSpacing: "0.26em",
                            color: RED_HOT,
                        }}
                    >
                        Official Jabulani lines
                    </p>
                    <p className="text-xs mb-4" style={{ color: MUTED }}>
                        These are our only numbers. Anything different is not
                        us.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {OFFICIAL_LINES.map((l) => {
                            const inner = (
                                <>
                                    <span
                                        className="block text-sm font-semibold tabular-nums"
                                        style={{ color: INK_LIGHT }}
                                    >
                                        {l.num}
                                    </span>
                                    <span
                                        className="block text-xs"
                                        style={{
                                            color: l.wa ? RED_HOT : MUTED,
                                        }}
                                    >
                                        {l.role}
                                    </span>
                                </>
                            );
                            return l.wa ? (
                                <a
                                    key={l.num}
                                    href={`https://wa.me/${l.wa}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-3 rounded-xl border transition-all"
                                    style={{ borderColor: LINE_C }}
                                >
                                    {inner}
                                </a>
                            ) : (
                                <div
                                    key={l.num}
                                    className="p-3 rounded-xl border"
                                    style={{ borderColor: LINE_C }}
                                >
                                    {inner}
                                </div>
                            );
                        })}
                    </div>
                </footer>
            </main>

            {/* Sticky estimate bar */}
            {estimate && (
                <div
                    className="fixed bottom-0 left-0 right-0 backdrop-blur-md"
                    style={{
                        background: "rgba(12,9,8,0.86)",
                        borderTop: `1px solid ${LINE_C}`,
                        zIndex: 40,
                    }}
                >
                    <div className="max-w-xl mx-auto px-5 py-4">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <p
                                    className="uppercase text-xs"
                                    style={{
                                        ...archivo,
                                        fontWeight: 800,
                                        letterSpacing: "0.26em",
                                        color: MUTED,
                                    }}
                                >
                                    Your estimate
                                </p>
                                <p
                                    className="leading-none mt-1 tabular-nums"
                                    style={{
                                        ...archivo,
                                        fontWeight: 900,
                                        fontSize: "2.2rem",
                                    }}
                                >
                                    <span style={{ color: RED_HOT }}>
                                        {"\u20A6"}
                                    </span>
                                    {shownValue.toLocaleString("en-NG")}
                                </p>
                                <p
                                    className="text-xs mt-1"
                                    style={{ color: MUTED }}
                                >
                                    {qty > 1
                                        ? `${qty} \u00D7 ${naira(estimate.value)} \u00B7 ${model} ${storage}`
                                        : `${model} ${storage} \u00B7 final value confirmed on inspection`}
                                </p>
                            </div>
                            <a
                                href={whatsappLink()}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-shrink-0 px-5 py-3 rounded-full text-sm font-bold text-white"
                                style={{
                                    ...archivo,
                                    background: `linear-gradient(135deg, ${RED_HOT}, ${RED})`,
                                    boxShadow: "0 0 30px rgba(202,42,30,0.5)",
                                }}
                            >
                                Lock my quote
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
