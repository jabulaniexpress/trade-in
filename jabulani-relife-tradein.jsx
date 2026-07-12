import { useEffect, useMemo, useRef, useState } from "react";
const BASE_RATE = 0.75;
const BASELINE_USD_RATE = 1390;
const CURRENT_USD_RATE = 1380;
const FX = CURRENT_USD_RATE / BASELINE_USD_RATE;
const ESIM_ONLY_DEDUCTION = 0.1;
const CARRIER_LOCK_DEDUCTION = 0.35;
const CONDITIONS = [
    {
        id: "excellent",
        label: "Excellent",
        badge: "Almost new",
        mult: 1,
        desc: "Very clean body and screen, with no obvious marks at arm’s length.",
    },
    {
        id: "good",
        label: "Good",
        badge: "Normal wear",
        mult: 0.92,
        desc: "Light scratches or signs of use, but still clean and presentable.",
    },
    {
        id: "rough",
        label: "Rough",
        badge: "Visible wear",
        mult: 0.78,
        desc: "Noticeable scratches, scuffs, dents or wear across the device.",
    },
];
const ISSUES = [
    { id: "battery", label: "Battery health below 85%", pct: 0.08 },
    { id: "screen_crack", label: "Cracked or replaced screen", pct: 0.15 },
    { id: "screen_scratch", label: "Deep scratches on screen", pct: 0.06 },
    { id: "camera", label: "Faulty front or rear camera", pct: 0.1 },
    { id: "biometrics", label: "Face ID / fingerprint not working", pct: 0.1 },
    { id: "body", label: "Dents or cracked back glass", pct: 0.07 },
    { id: "audio_charge", label: "Speaker, mic or charging fault", pct: 0.08 },
];
const FOLD_ISSUES = [
    {
        id: "fold_inner",
        label: "Inner screen has dead pixels, lines or crease damage",
        pct: 0.2,
    },
    {
        id: "fold_protector",
        label: "Inner screen protector is peeling or bubbling",
        pct: 0.05,
    },
    {
        id: "fold_hinge",
        label: "Hinge is loose, stiff or does not stay open",
        pct: 0.12,
    },
];
const ALL_ISSUES = [...ISSUES, ...FOLD_ISSUES];
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
    "The online value is an estimate, not a final or binding offer. The final value is confirmed after physical inspection.",
    "All trade-ins are completed at 2A Olaide Tomori Street, Ikeja, Computer Village. We do not complete swaps by courier or at a customer’s home.",
    "Estimates remain valid for 48 hours and may change when market prices or exchange rates move.",
    "You must be the lawful owner of the device. A valid government-issued ID is required and every IMEI is checked.",
    "iCloud, Google and other activation locks must be removed before a trade-in can be completed.",
    "Back up and erase your personal data before handover. Jabulani Express is not responsible for information left on a device.",
    "Trade-in value may be received as cash or used as credit toward another device, subject to final inspection and approval.",
    "Jabulani Express may revise or decline any estimate where the physical device differs from the information supplied online.",
];
const isEsimEra = (brand, model) => {
    if (brand !== "iPhone" || !model || model.includes("Air")) return false;
    const match = model.match(/^iPhone (\d+)/);
    return match ? Number.parseInt(match[1], 10) >= 14 : false;
};
const isFoldable = (model) =>
    Boolean(model && (model.includes("Fold") || model.includes("Flip")));
const naira = (value) =>
    new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
    }).format(value);
const roundDown5k = (value) => Math.floor(value / 5000) * 5000;
const hashText = (value) => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
};
const getSalesLine = (key) =>
    SALES_LINES[hashText(key || "jabulani-relife") % SALES_LINES.length];
/* ================================================================
   PRICE SOURCES & MAINTENANCE (for Afeez / Yasir)
   ----------------------------------------------------------------
   Precedence on overlaps: Mobi King > purchase invoices > Smart
   Areena / FJ Device > local NGN lists > Circle Stock.
   - Mobi King Phones FZCO Dubai (Grade A): AED x N378.75 (USD1 = N1,390 / 3.67)
   - Purchase invoices 17/06/26 (China, actual transacted): RMB x N215.5
   - Smart Areena Phones LLC (clean tested, 3mo warranty): AED x N378.75
   - FJ Device 29/06/26 (UK used, Grade A/A+ non-boosted): AED x N378.75
   - Circle Stock 09/07 (UK, best grade per model): GBP x N1,876.50
   - Apple ASIS list (used, active stock with box): USD x N1,390
   - Local NGN lists 11/07/26: 15/16/17 series incl. 15 Pro, 16 Pro,
     16e, 17 Air (16 Plus & 16e = eSIM prices as base; 15 Pro 256
     derived from new-unit price)
   FX: when the dollar rate changes, update CURRENT_USD_RATE only.
   All values below are anchored to the N1,390 baseline.
   ================================================================ */
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
function useCountUp(target) {
    const [value, setValue] = useState(target ?? 0);
    const currentValue = useRef(target ?? 0);
    useEffect(() => {
        if (target === null) return;
        const start = currentValue.current;
        const difference = target - start;
        if (difference === 0) return;
        const startedAt = performance.now();
        let frame = 0;
        const tick = (time) => {
            const progress = Math.min((time - startedAt) / 450, 1);
            const eased = 1 - (1 - progress) ** 3;
            const nextValue = Math.round(start + difference * eased);
            currentValue.current = nextValue;
            setValue(nextValue);
            if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target]);
    return value;
}
function CheckIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
                d="M4 10.5 8 14l8-9"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
            />
        </svg>
    );
}
function ChevronIcon({ open = false }) {
    return (
        <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            style={{ transform: open ? "rotate(180deg)" : undefined }}
        >
            <path
                d="m5 7.5 5 5 5-5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
            />
        </svg>
    );
}
function WhatsAppIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.4-4.2A8.5 8.5 0 1 1 20.5 11.7Z"
                fill="none"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="1.8"
            />
            <path
                d="M8.2 7.7c.3-.5.6-.5.9-.5h.5c.2 0 .4.1.5.4l.8 1.9c.1.3.1.5-.1.7l-.6.7c-.2.2-.2.4-.1.6.4.8 1.2 1.8 2.2 2.4.3.2.5.2.7 0l.8-1c.2-.2.4-.3.7-.2l1.9.9c.3.1.4.3.4.5 0 .7-.4 1.6-1 2-.6.4-1.4.6-2.3.3-1.2-.3-2.8-1-4.4-2.5-1.3-1.2-2.3-2.7-2.7-4-.4-1-.2-1.8.2-2.3Z"
                fill="currentColor"
            />
        </svg>
    );
}
function StepCard({ number, title, subtitle, complete = false, children }) {
    return (
        <section className="jr-step">
            <div className="jr-step__head">
                <div
                    className={`jr-step__number ${complete ? "is-complete" : ""}`}
                >
                    {complete ? <CheckIcon /> : number}
                </div>
                <div>
                    <h2>{title}</h2>
                    {subtitle ? <p>{subtitle}</p> : null}
                </div>
            </div>
            <div className="jr-step__body">{children}</div>
        </section>
    );
}
function Choice({ active, onClick, children, compact = false }) {
    return (
        <button
            type="button"
            className={`jr-choice ${active ? "is-active" : ""} ${compact ? "is-compact" : ""}`}
            onClick={onClick}
            aria-pressed={active}
        >
            {children}
        </button>
    );
}
export default function JabulaniReLife() {
    const [brand, setBrand] = useState(null);
    const [model, setModel] = useState(null);
    const [storage, setStorage] = useState(null);
    const [simType, setSimType] = useState(null);
    const [networkStatus, setNetworkStatus] = useState(null);
    const [activationRemoved, setActivationRemoved] = useState(null);
    const [condition, setCondition] = useState(null);
    const [issues, setIssues] = useState([]);
    const [quantity, setQuantity] = useState(1);
    const [modelSearch, setModelSearch] = useState("");
    const [showTerms, setShowTerms] = useState(false);
    const [showOfficialLines, setShowOfficialLines] = useState(false);
    useEffect(() => {
        const fontLink = document.createElement("link");
        fontLink.rel = "stylesheet";
        fontLink.href =
            "https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Sora:wght@400;500;600;700&display=swap";
        document.head.appendChild(fontLink);
        return () => fontLink.remove();
    }, []);
    const modelObject = useMemo(
        () =>
            brand && model
                ? (CATALOG[brand].find((entry) => entry.name === model) ?? null)
                : null,
        [brand, model],
    );
    const needsSimType = isEsimEra(brand, model);
    const filteredModels = useMemo(() => {
        if (!brand) return [];
        const query = modelSearch.trim().toLowerCase();
        if (!query) return CATALOG[brand];
        return CATALOG[brand].filter((entry) =>
            entry.name.toLowerCase().includes(query),
        );
    }, [brand, modelSearch]);
    const quote = useMemo(() => {
        if (
            !brand ||
            !modelObject ||
            !storage ||
            !condition ||
            !networkStatus ||
            activationRemoved !== true ||
            (needsSimType && !simType)
        ) {
            return null;
        }
        const supplierCost = modelObject.storages[storage] * FX;
        const conditionProfile = CONDITIONS.find(
            (entry) => entry.id === condition,
        );
        if (!conditionProfile) return null;
        const issueDeduction = issues.reduce((total, issueId) => {
            const issue = ALL_ISSUES.find((entry) => entry.id === issueId);
            return total + (issue?.pct ?? 0);
        }, 0);
        const simDeduction =
            needsSimType && simType === "esim" ? ESIM_ONLY_DEDUCTION : 0;
        const networkDeduction =
            networkStatus === "locked" ? CARRIER_LOCK_DEDUCTION : 0;
        const baseValue = supplierCost * BASE_RATE * conditionProfile.mult;
        const adjustedValue = Math.max(
            baseValue * (1 - issueDeduction - simDeduction - networkDeduction),
            baseValue * 0.2,
        );
        const perUnit = roundDown5k(adjustedValue);
        return {
            perUnit,
            total: perUnit * quantity,
            costBasis: supplierCost,
        };
    }, [
        activationRemoved,
        brand,
        condition,
        issues,
        modelObject,
        needsSimType,
        networkStatus,
        quantity,
        simType,
        storage,
    ]);
    const animatedTotal = useCountUp(quote?.total ?? null);
    const completedSteps = [
        Boolean(brand),
        Boolean(model),
        Boolean(storage),
        ...(needsSimType ? [Boolean(simType)] : []),
        Boolean(networkStatus),
        activationRemoved === true,
        Boolean(condition),
    ];
    const completedCount = completedSteps.filter(Boolean).length;
    const progress = completedCount / completedSteps.length;
    const activeIssues = isFoldable(model) ? ALL_ISSUES : ISSUES;
    const selectedCondition = CONDITIONS.find(
        (entry) => entry.id === condition,
    );
    const salesKey = [brand, model, storage].filter(Boolean).join("-");
    const salesLine = getSalesLine(salesKey);
    const resetAfterBrand = (nextBrand) => {
        setBrand(nextBrand);
        setModel(null);
        setStorage(null);
        setSimType(null);
        setNetworkStatus(null);
        setActivationRemoved(null);
        setCondition(null);
        setIssues([]);
        setQuantity(1);
        setModelSearch("");
    };
    const resetAfterModel = (nextModel) => {
        setModel(nextModel);
        setStorage(null);
        setSimType(null);
        setNetworkStatus(null);
        setActivationRemoved(null);
        setCondition(null);
        setIssues([]);
        setQuantity(1);
    };
    const resetAll = () => {
        setBrand(null);
        setModel(null);
        setStorage(null);
        setSimType(null);
        setNetworkStatus(null);
        setActivationRemoved(null);
        setCondition(null);
        setIssues([]);
        setQuantity(1);
        setModelSearch("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const toggleIssue = (issueId) => {
        setIssues((current) =>
            current.includes(issueId)
                ? current.filter((entry) => entry !== issueId)
                : [...current, issueId],
        );
    };
    const whatsappUrl = useMemo(() => {
        if (!quote || !brand || !model || !storage || !selectedCondition)
            return "#";
        const issueText = issues.length
            ? issues
                  .map(
                      (issueId) =>
                          ALL_ISSUES.find((entry) => entry.id === issueId)
                              ?.label,
                  )
                  .filter(Boolean)
                  .join(", ")
            : "No fault reported";
        const lines = [
            "Hello Jabulani Express, I used the ReLife trade-in calculator and would like a physical inspection.",
            "",
            `Device: ${model} ${storage}`,
            `Brand: ${brand}`,
            needsSimType
                ? `SIM type: ${simType === "esim" ? "eSIM only" : "Physical SIM + eSIM"}`
                : null,
            `Network: ${networkStatus === "locked" ? "Carrier locked" : "Factory unlocked"}`,
            `Condition: ${selectedCondition.label}`,
            `Faults: ${issueText}`,
            quantity > 1 ? `Quantity: ${quantity} units` : null,
            `Online estimate: ${naira(quote.total)}${quantity > 1 ? ` (${naira(quote.perUnit)} per unit)` : ""}`,
            "",
            "I understand the final value will be confirmed after inspection at the Ikeja store.",
        ].filter((line) => line !== null);
        return `https://wa.me/${salesLine}?text=${encodeURIComponent(lines.join("\n"))}`;
    }, [
        brand,
        issues,
        model,
        needsSimType,
        networkStatus,
        quantity,
        quote,
        salesLine,
        selectedCondition,
        simType,
        storage,
    ]);
    return (
        <div className="jr-app">
            <style>{styles}</style>

            <div className="jr-progress" aria-hidden="true">
                <span style={{ width: `${Math.min(progress * 100, 100)}%` }} />
            </div>

            <header className="jr-header">
                <div className="jr-topbar">
                    <div className="jr-shell jr-topbar__inner">
                        <span>Authentic devices. Transparent value.</span>
                        <span className="jr-topbar__location">
                            2A Olaide Tomori Street, Ikeja
                        </span>
                    </div>
                </div>

                <div className="jr-shell jr-nav">
                    <div
                        className="jr-brandmark"
                        aria-label="Jabulani Express ReLife"
                    >
                        <span className="jr-brandmark__word">JABULANI</span>
                        <span className="jr-brandmark__express">EXPRESS</span>
                        <span className="jr-brandmark__divider" />
                        <span className="jr-brandmark__relife">ReLife</span>
                    </div>
                    <div className="jr-nav__meta">Trade-in &amp; upgrade</div>
                </div>

                <div className="jr-shell jr-hero">
                    <div className="jr-hero__copy">
                        <div className="jr-eyebrow">
                            <span />
                            Jabulani Express ReLife
                        </div>
                        <h1>
                            Your old phone can pay for your <em>next one.</em>
                        </h1>
                        <p>
                            Get a realistic trade-in estimate, then visit our
                            Ikeja store for inspection, final confirmation and
                            settlement.
                        </p>

                        <div className="jr-trust-row">
                            <div>
                                <strong>Cash or upgrade credit</strong>
                                <span>Choose what works for you</span>
                            </div>
                            <div>
                                <strong>Transparent inspection</strong>
                                <span>No hidden trade-in process</span>
                            </div>
                            <div>
                                <strong>Multiple devices welcome</strong>
                                <span>Retail and bulk trade-ins</span>
                            </div>
                        </div>
                    </div>

                    <div className="jr-hero__visual" aria-hidden="true">
                        <div className="jr-phone jr-phone--back">
                            <span className="jr-camera">
                                <i />
                                <i />
                                <i />
                            </span>
                        </div>
                        <div className="jr-phone jr-phone--front">
                            <div className="jr-phone__screen">
                                <span>ReLife</span>
                                <strong>Trade in.</strong>
                                <strong>Upgrade smarter.</strong>
                            </div>
                        </div>
                        <div className="jr-value-badge">
                            <small>YOUR PHONE</small>
                            <strong>STILL HAS VALUE</strong>
                        </div>
                    </div>
                </div>
            </header>

            <main className="jr-shell jr-main">
                <div className="jr-form">
                    <div className="jr-intro">
                        <div>
                            <span className="jr-kicker">
                                Trade-in calculator
                            </span>
                            <h2>Tell us about your device</h2>
                        </div>
                        <span className="jr-completion">
                            {completedCount}/{completedSteps.length} completed
                        </span>
                    </div>

                    <StepCard
                        number="01"
                        title="Choose the brand"
                        subtitle="Select the manufacturer of the device you want to trade in."
                        complete={Boolean(brand)}
                    >
                        <div className="jr-brand-grid">
                            {Object.keys(CATALOG).map((entry) => (
                                <Choice
                                    key={entry}
                                    active={brand === entry}
                                    onClick={() => resetAfterBrand(entry)}
                                >
                                    <span className="jr-brand-choice__name">
                                        {entry}
                                    </span>
                                    <span className="jr-brand-choice__count">
                                        {CATALOG[entry].length} models
                                    </span>
                                </Choice>
                            ))}
                        </div>
                    </StepCard>

                    {brand ? (
                        <StepCard
                            number="02"
                            title="Choose the model"
                            subtitle={`Search or select your ${brand} model.`}
                            complete={Boolean(model)}
                        >
                            <label className="jr-search">
                                <span>Search model</span>
                                <input
                                    value={modelSearch}
                                    onChange={(event) =>
                                        setModelSearch(event.target.value)
                                    }
                                    placeholder={`e.g. ${
                                        brand === "iPhone"
                                            ? "iPhone 15 Pro Max"
                                            : brand === "Samsung"
                                              ? "Galaxy S24 Ultra"
                                              : "Pixel 8 Pro"
                                    }`}
                                />
                            </label>

                            <div className="jr-model-grid">
                                {filteredModels.map((entry) => (
                                    <Choice
                                        key={entry.name}
                                        active={model === entry.name}
                                        onClick={() =>
                                            resetAfterModel(entry.name)
                                        }
                                        compact
                                    >
                                        {entry.name}
                                    </Choice>
                                ))}
                            </div>

                            {filteredModels.length === 0 ? (
                                <div className="jr-empty">
                                    This model is not currently listed. Message
                                    a sales advisor for a manual valuation.
                                </div>
                            ) : null}
                        </StepCard>
                    ) : null}

                    {modelObject ? (
                        <StepCard
                            number="03"
                            title="Select storage"
                            subtitle="Choose the exact storage capacity shown in your phone settings."
                            complete={Boolean(storage)}
                        >
                            <div className="jr-choice-row">
                                {Object.keys(modelObject.storages).map(
                                    (entry) => (
                                        <Choice
                                            key={entry}
                                            active={storage === entry}
                                            onClick={() => setStorage(entry)}
                                            compact
                                        >
                                            {entry}
                                        </Choice>
                                    ),
                                )}
                            </div>
                        </StepCard>
                    ) : null}

                    {storage && needsSimType ? (
                        <StepCard
                            number="04"
                            title="Select the SIM type"
                            subtitle="An iPhone without a physical SIM tray is usually a US eSIM-only unit."
                            complete={Boolean(simType)}
                        >
                            <div className="jr-two-choice">
                                <Choice
                                    active={simType === "psim"}
                                    onClick={() => setSimType("psim")}
                                >
                                    <strong>Physical SIM + eSIM</strong>
                                    <span>The phone has a SIM tray</span>
                                </Choice>
                                <Choice
                                    active={simType === "esim"}
                                    onClick={() => setSimType("esim")}
                                >
                                    <strong>eSIM only</strong>
                                    <span>No physical SIM tray</span>
                                </Choice>
                            </div>
                        </StepCard>
                    ) : null}

                    {storage && (!needsSimType || simType) ? (
                        <StepCard
                            number={needsSimType ? "05" : "04"}
                            title="Confirm network status"
                            subtitle="Factory-unlocked phones accept Nigerian SIM cards from any network."
                            complete={Boolean(networkStatus)}
                        >
                            <div className="jr-two-choice">
                                <Choice
                                    active={networkStatus === "unlocked"}
                                    onClick={() => setNetworkStatus("unlocked")}
                                >
                                    <strong>Factory unlocked</strong>
                                    <span>Any Nigerian SIM works</span>
                                </Choice>
                                <Choice
                                    active={networkStatus === "locked"}
                                    onClick={() => setNetworkStatus("locked")}
                                >
                                    <strong>Carrier locked</strong>
                                    <span>Restricted to a foreign network</span>
                                </Choice>
                            </div>
                        </StepCard>
                    ) : null}

                    {networkStatus ? (
                        <StepCard
                            number={needsSimType ? "06" : "05"}
                            title={
                                brand === "iPhone"
                                    ? "Is iCloud fully signed out?"
                                    : "Is the Google account removed?"
                            }
                            subtitle="We cannot accept an activation-locked phone. You must be able to erase and activate the device."
                            complete={activationRemoved === true}
                        >
                            <div className="jr-two-choice">
                                <Choice
                                    active={activationRemoved === true}
                                    onClick={() => setActivationRemoved(true)}
                                >
                                    <strong>Yes, fully removed</strong>
                                    <span>
                                        The device can be reset and activated
                                    </span>
                                </Choice>
                                <Choice
                                    active={activationRemoved === false}
                                    onClick={() => setActivationRemoved(false)}
                                >
                                    <strong>Not yet</strong>
                                    <span>I still need to sign out</span>
                                </Choice>
                            </div>

                            {activationRemoved === false ? (
                                <div className="jr-alert">
                                    <strong>
                                        Remove the account before visiting.
                                    </strong>
                                    <span>
                                        A sales advisor can guide you, but the
                                        trade-in cannot be completed while
                                        activation lock remains on.
                                    </span>
                                </div>
                            ) : null}
                        </StepCard>
                    ) : null}

                    {activationRemoved === true ? (
                        <StepCard
                            number={needsSimType ? "07" : "06"}
                            title="Rate the physical condition"
                            subtitle="Choose the description that most honestly matches the device."
                            complete={Boolean(condition)}
                        >
                            <div className="jr-condition-list">
                                {CONDITIONS.map((entry) => (
                                    <button
                                        type="button"
                                        key={entry.id}
                                        className={`jr-condition ${condition === entry.id ? "is-active" : ""}`}
                                        onClick={() => setCondition(entry.id)}
                                        aria-pressed={condition === entry.id}
                                    >
                                        <span className="jr-condition__radio">
                                            {condition === entry.id ? (
                                                <i />
                                            ) : null}
                                        </span>
                                        <span className="jr-condition__copy">
                                            <strong>{entry.label}</strong>
                                            <small>{entry.badge}</small>
                                            <span>{entry.desc}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </StepCard>
                    ) : null}

                    {condition ? (
                        <StepCard
                            number={needsSimType ? "08" : "07"}
                            title="Select every known fault"
                            subtitle="Leave all options unticked only when none of these issues applies."
                            complete
                        >
                            <div className="jr-issue-list">
                                {activeIssues.map((entry) => {
                                    const selected = issues.includes(entry.id);
                                    return (
                                        <button
                                            type="button"
                                            key={entry.id}
                                            className={`jr-issue ${selected ? "is-active" : ""}`}
                                            onClick={() =>
                                                toggleIssue(entry.id)
                                            }
                                            aria-pressed={selected}
                                        >
                                            <span className="jr-checkbox">
                                                {selected ? (
                                                    <CheckIcon />
                                                ) : null}
                                            </span>
                                            <span>{entry.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </StepCard>
                    ) : null}

                    {quote ? (
                        <section className="jr-quantity">
                            <div>
                                <span className="jr-kicker">
                                    Multiple units
                                </span>
                                <h3>Trading in more than one?</h3>
                                <p>
                                    Use this only when every unit is the same
                                    model, storage and condition.
                                </p>
                            </div>
                            <div className="jr-counter" aria-label="Quantity">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setQuantity((current) =>
                                            Math.max(1, current - 1),
                                        )
                                    }
                                    aria-label="Reduce quantity"
                                >
                                    −
                                </button>
                                <strong>{quantity}</strong>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setQuantity((current) =>
                                            Math.min(10, current + 1),
                                        )
                                    }
                                    aria-label="Increase quantity"
                                >
                                    +
                                </button>
                            </div>
                        </section>
                    ) : null}

                    <section className="jr-accordions">
                        <button
                            type="button"
                            className="jr-accordion__trigger"
                            onClick={() => setShowTerms((current) => !current)}
                            aria-expanded={showTerms}
                        >
                            <span>
                                <strong>Trade-in terms</strong>
                                <small>
                                    Inspection, ownership and estimate
                                    conditions
                                </small>
                            </span>
                            <ChevronIcon open={showTerms} />
                        </button>
                        {showTerms ? (
                            <ol className="jr-terms">
                                {TERMS.map((term, index) => (
                                    <li key={term}>
                                        <span>
                                            {String(index + 1).padStart(2, "0")}
                                        </span>
                                        <p>{term}</p>
                                    </li>
                                ))}
                            </ol>
                        ) : null}

                        <button
                            type="button"
                            className="jr-accordion__trigger"
                            onClick={() =>
                                setShowOfficialLines((current) => !current)
                            }
                            aria-expanded={showOfficialLines}
                        >
                            <span>
                                <strong>
                                    Verify an official Jabulani line
                                </strong>
                                <small>
                                    Protect yourself from impersonation and
                                    fraud
                                </small>
                            </span>
                            <ChevronIcon open={showOfficialLines} />
                        </button>
                        {showOfficialLines ? (
                            <div className="jr-lines">
                                {OFFICIAL_LINES.map((line) =>
                                    line.wa ? (
                                        <a
                                            key={line.num}
                                            href={`https://wa.me/${line.wa}`}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            <strong>{line.num}</strong>
                                            <span>{line.role}</span>
                                        </a>
                                    ) : (
                                        <div key={line.num}>
                                            <strong>{line.num}</strong>
                                            <span>{line.role}</span>
                                        </div>
                                    ),
                                )}
                            </div>
                        ) : null}
                    </section>
                </div>

                <aside className="jr-summary">
                    <div
                        className={`jr-summary__card ${quote ? "has-quote" : ""}`}
                    >
                        <div className="jr-summary__top">
                            <span className="jr-kicker">
                                Your ReLife estimate
                            </span>
                            {quote ? (
                                <button type="button" onClick={resetAll}>
                                    Start again
                                </button>
                            ) : null}
                        </div>

                        {quote ? (
                            <>
                                <div className="jr-estimate">
                                    <span>Estimated trade-in value</span>
                                    <strong>{naira(animatedTotal)}</strong>
                                    {quantity > 1 ? (
                                        <small>
                                            {quantity} × {naira(quote.perUnit)}{" "}
                                            per unit
                                        </small>
                                    ) : (
                                        <small>For one device</small>
                                    )}
                                </div>

                                <div className="jr-summary__device">
                                    <div>
                                        <span>Device</span>
                                        <strong>
                                            {model} {storage}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Condition</span>
                                        <strong>
                                            {selectedCondition?.label}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Network</span>
                                        <strong>
                                            {networkStatus === "locked"
                                                ? "Carrier locked"
                                                : "Factory unlocked"}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Reported faults</span>
                                        <strong>
                                            {issues.length || "None"}
                                        </strong>
                                    </div>
                                </div>

                                <a
                                    className="jr-whatsapp"
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <WhatsAppIcon />
                                    Continue on WhatsApp
                                </a>

                                <p className="jr-disclaimer">
                                    This is an indicative online estimate. Final
                                    value is confirmed only after physical
                                    inspection at our Ikeja store.
                                </p>
                            </>
                        ) : (
                            <div className="jr-summary__empty">
                                <div className="jr-summary__ring">
                                    <span>{Math.round(progress * 100)}%</span>
                                </div>
                                <h3>Your estimate will appear here</h3>
                                <p>
                                    Complete the device questions honestly for
                                    the closest possible trade-in value.
                                </p>
                                <ul>
                                    <li>
                                        <CheckIcon />
                                        Cash or upgrade credit
                                    </li>
                                    <li>
                                        <CheckIcon />
                                        Physical inspection in Ikeja
                                    </li>
                                    <li>
                                        <CheckIcon />
                                        Final value after inspection
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="jr-store-card">
                        <span className="jr-store-card__pin">J</span>
                        <div>
                            <strong>Complete your trade-in in store</strong>
                            <p>
                                2A Olaide Tomori Street, Ikeja, Computer
                                Village, Lagos.
                            </p>
                        </div>
                    </div>
                </aside>
            </main>

            {quote ? (
                <div className="jr-mobile-result">
                    <div>
                        <span>Estimated value</span>
                        <strong>{naira(animatedTotal)}</strong>
                    </div>
                    <a href={whatsappUrl} target="_blank" rel="noreferrer">
                        Continue
                    </a>
                </div>
            ) : null}

            <footer className="jr-footer">
                <div className="jr-shell">
                    <div className="jr-brandmark jr-brandmark--footer">
                        <span className="jr-brandmark__word">JABULANI</span>
                        <span className="jr-brandmark__express">EXPRESS</span>
                    </div>
                    <p>
                        ReLife by Jabulani Express — giving quality devices a
                        valuable second life.
                    </p>
                    <small>
                        © {new Date().getFullYear()} Jabulani Express Limited.
                    </small>
                </div>
            </footer>
        </div>
    );
}
const styles = `
  :root {
    color-scheme: light;
  }

  * {
    box-sizing: border-box;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    margin: 0;
    background: #f6f6f4;
  }

  button,
  input {
    font: inherit;
  }

  button,
  a {
    -webkit-tap-highlight-color: transparent;
  }

  .jr-app {
    --red: #CA2A1E;
    --red-dark: #a91610;
    --black: #0d0d0d;
    --ink: #171717;
    --muted: #6f706f;
    --line: #dfdfdc;
    --soft: #f4f4f1;
    --white: #ffffff;
    min-height: 100vh;
    overflow-x: hidden;
    background:
      linear-gradient(180deg, #ffffff 0, #ffffff 580px, #f6f6f4 580px);
    color: var(--ink);
    font-family: "Sora", Arial, sans-serif;
  }

  .jr-shell {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
  }

  .jr-progress {
    position: fixed;
    inset: 0 0 auto;
    height: 4px;
    z-index: 100;
    background: rgba(13, 13, 13, 0.08);
  }

  .jr-progress span {
    display: block;
    height: 100%;
    background: var(--red);
    transition: width 350ms ease;
  }

  .jr-header {
    position: relative;
    background:
      radial-gradient(circle at 86% 15%, rgba(214, 40, 30, 0.12), transparent 24%),
      linear-gradient(180deg, #fff 0%, #fbfbf9 100%);
    border-bottom: 1px solid #e7e7e4;
  }

  .jr-topbar {
    background: var(--black);
    color: #fff;
    font-size: 12px;
  }

  .jr-topbar__inner {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    padding: 9px 0;
  }

  .jr-topbar__location {
    color: #bdbdbd;
  }

  .jr-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 76px;
    border-bottom: 1px solid rgba(13, 13, 13, 0.08);
  }

  .jr-brandmark {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    font-family: "Archivo", Arial, sans-serif;
    line-height: 1;
  }

  .jr-brandmark__word {
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -0.045em;
  }

  .jr-brandmark__express {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.16em;
    color: var(--red);
  }

  .jr-brandmark__divider {
    align-self: stretch;
    width: 1px;
    margin: -4px 8px;
    background: #d8d8d5;
  }

  .jr-brandmark__relife {
    font-size: 17px;
    font-weight: 800;
    font-style: italic;
    color: var(--red);
  }

  .jr-nav__meta {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #777;
  }

  .jr-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(340px, 0.85fr);
    gap: 70px;
    min-height: 440px;
    align-items: center;
    padding-top: 54px;
    padding-bottom: 54px;
  }

  .jr-eyebrow,
  .jr-kicker {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    font-family: "Archivo", Arial, sans-serif;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--red);
  }

  .jr-eyebrow span {
    width: 24px;
    height: 3px;
    background: var(--red);
  }

  .jr-hero h1 {
    max-width: 720px;
    margin: 18px 0 18px;
    font-family: "Archivo", Arial, sans-serif;
    font-size: clamp(43px, 5.6vw, 72px);
    line-height: 0.98;
    letter-spacing: -0.055em;
  }

  .jr-hero h1 em {
    color: var(--red);
    font-style: normal;
  }

  .jr-hero__copy > p {
    max-width: 610px;
    margin: 0;
    color: var(--muted);
    font-size: 17px;
    line-height: 1.65;
  }

  .jr-trust-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    margin-top: 32px;
    border: 1px solid #e1e1de;
    border-radius: 14px;
    overflow: hidden;
    background: #e1e1de;
  }

  .jr-trust-row div {
    min-height: 86px;
    padding: 17px;
    background: #fff;
  }

  .jr-trust-row strong,
  .jr-trust-row span {
    display: block;
  }

  .jr-trust-row strong {
    font-size: 13px;
  }

  .jr-trust-row span {
    margin-top: 5px;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.4;
  }

  .jr-hero__visual {
    position: relative;
    height: 350px;
  }

  .jr-phone {
    position: absolute;
    width: 175px;
    height: 330px;
    border-radius: 34px;
    box-shadow: 0 24px 60px rgba(10, 10, 10, 0.2);
  }

  .jr-phone--back {
    top: 2px;
    left: 48px;
    transform: rotate(-11deg);
    background: linear-gradient(145deg, #151515, #343434);
    border: 5px solid #272727;
  }

  .jr-camera {
    position: absolute;
    top: 18px;
    left: 17px;
    display: grid;
    grid-template-columns: repeat(2, 30px);
    gap: 7px;
    padding: 9px;
    border-radius: 17px;
    background: #222;
  }

  .jr-camera i {
    width: 30px;
    height: 30px;
    border: 3px solid #494949;
    border-radius: 50%;
    background: #050505;
  }

  .jr-camera i:last-child {
    grid-column: 1 / 2;
  }

  .jr-phone--front {
    top: 8px;
    right: 34px;
    z-index: 2;
    padding: 6px;
    transform: rotate(8deg);
    background: #101010;
  }

  .jr-phone--front::before {
    content: "";
    position: absolute;
    top: 13px;
    left: 50%;
    z-index: 3;
    width: 56px;
    height: 16px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: #050505;
  }

  .jr-phone__screen {
    display: flex;
    height: 100%;
    flex-direction: column;
    justify-content: flex-end;
    padding: 24px 17px;
    border-radius: 29px;
    overflow: hidden;
    background:
      radial-gradient(circle at 70% 24%, rgba(255,255,255,.22), transparent 18%),
      linear-gradient(155deg, #E8402F 0%, #CA2A1E 44%, #6d0703 100%);
    color: #fff;
    font-family: "Archivo", Arial, sans-serif;
  }

  .jr-phone__screen span {
    margin-bottom: auto;
    font-size: 14px;
    font-weight: 800;
    font-style: italic;
  }

  .jr-phone__screen strong {
    font-size: 21px;
    line-height: 1.05;
    letter-spacing: -0.04em;
  }

  .jr-value-badge {
    position: absolute;
    right: -8px;
    bottom: 20px;
    z-index: 4;
    padding: 14px 16px;
    border: 1px solid rgba(255,255,255,.22);
    border-radius: 12px;
    background: var(--black);
    color: #fff;
    box-shadow: 0 14px 35px rgba(0,0,0,.22);
    transform: rotate(-2deg);
  }

  .jr-value-badge small,
  .jr-value-badge strong {
    display: block;
    font-family: "Archivo", Arial, sans-serif;
  }

  .jr-value-badge small {
    margin-bottom: 3px;
    color: #aaa;
    font-size: 8px;
    letter-spacing: .18em;
  }

  .jr-value-badge strong {
    font-size: 13px;
    letter-spacing: .04em;
  }

  .jr-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 370px;
    align-items: start;
    gap: 32px;
    padding-top: 48px;
    padding-bottom: 90px;
  }

  .jr-form {
    min-width: 0;
  }

  .jr-intro {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
  }

  .jr-intro h2 {
    margin: 8px 0 0;
    font-family: "Archivo", Arial, sans-serif;
    font-size: 30px;
    letter-spacing: -0.035em;
  }

  .jr-completion {
    padding-bottom: 4px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }

  .jr-step {
    margin-bottom: 16px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 8px 24px rgba(15,15,15,.035);
    animation: jr-enter .35s ease both;
  }

  @keyframes jr-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .jr-step__head {
    display: flex;
    gap: 14px;
    padding: 21px 22px 17px;
    border-bottom: 1px solid #eeeeeb;
  }

  .jr-step__number {
    display: grid;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 50%;
    background: #171717;
    color: #fff;
    font-family: "Archivo", Arial, sans-serif;
    font-size: 11px;
    font-weight: 800;
  }

  .jr-step__number.is-complete {
    background: var(--red);
  }

  .jr-step__number svg {
    width: 17px;
    height: 17px;
  }

  .jr-step__head h2 {
    margin: 1px 0 5px;
    font-family: "Archivo", Arial, sans-serif;
    font-size: 17px;
    letter-spacing: -0.02em;
  }

  .jr-step__head p {
    margin: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.45;
  }

  .jr-step__body {
    padding: 20px 22px 22px;
  }

  .jr-brand-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .jr-choice {
    min-height: 58px;
    padding: 14px 15px;
    border: 1px solid #dededb;
    border-radius: 12px;
    background: #fff;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease,
      transform 160ms ease, background 160ms ease;
  }

  .jr-choice:hover {
    border-color: #b4b4b0;
    transform: translateY(-1px);
  }

  .jr-choice.is-active {
    border-color: var(--red);
    background: #fff8f7;
    box-shadow: 0 0 0 2px rgba(214, 40, 30, 0.08);
  }

  .jr-choice.is-compact {
    min-height: 44px;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
  }

  .jr-brand-choice__name,
  .jr-brand-choice__count {
    display: block;
  }

  .jr-brand-choice__name {
    font-family: "Archivo", Arial, sans-serif;
    font-size: 16px;
    font-weight: 800;
  }

  .jr-brand-choice__count {
    margin-top: 5px;
    color: var(--muted);
    font-size: 10px;
  }

  .jr-search {
    display: block;
    margin-bottom: 14px;
  }

  .jr-search > span {
    display: block;
    margin-bottom: 7px;
    color: #555;
    font-size: 11px;
    font-weight: 700;
  }

  .jr-search input {
    width: 100%;
    height: 48px;
    padding: 0 14px;
    outline: none;
    border: 1px solid #d9d9d6;
    border-radius: 11px;
    background: #fafaf8;
    color: var(--ink);
    font-size: 13px;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }

  .jr-search input:focus {
    border-color: var(--red);
    box-shadow: 0 0 0 3px rgba(214, 40, 30, .09);
  }

  .jr-model-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    max-height: 292px;
    padding-right: 3px;
    overflow-y: auto;
  }

  .jr-model-grid::-webkit-scrollbar {
    width: 5px;
  }

  .jr-model-grid::-webkit-scrollbar-thumb {
    border-radius: 99px;
    background: #d5d5d2;
  }

  .jr-choice-row,
  .jr-two-choice {
    display: grid;
    gap: 10px;
  }

  .jr-choice-row {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .jr-two-choice {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .jr-two-choice .jr-choice strong,
  .jr-two-choice .jr-choice span {
    display: block;
  }

  .jr-two-choice .jr-choice strong {
    font-size: 13px;
  }

  .jr-two-choice .jr-choice span {
    margin-top: 5px;
    color: var(--muted);
    font-size: 10px;
    line-height: 1.4;
  }

  .jr-empty,
  .jr-alert {
    margin-top: 14px;
    border-radius: 11px;
    font-size: 12px;
    line-height: 1.5;
  }

  .jr-empty {
    padding: 13px 14px;
    background: #f6f6f3;
    color: var(--muted);
  }

  .jr-alert {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 15px;
    border: 1px solid #ffd0cc;
    background: #fff4f3;
    color: #5a1712;
  }

  .jr-alert span {
    color: #84524e;
  }

  .jr-condition-list,
  .jr-issue-list {
    display: grid;
    gap: 9px;
  }

  .jr-condition {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 15px;
    border: 1px solid #dededb;
    border-radius: 12px;
    background: #fff;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .jr-condition.is-active {
    border-color: var(--red);
    background: #fff8f7;
  }

  .jr-condition__radio {
    display: grid;
    flex: 0 0 20px;
    width: 20px;
    height: 20px;
    margin-top: 1px;
    place-items: center;
    border: 1.5px solid #b5b5b1;
    border-radius: 50%;
  }

  .jr-condition.is-active .jr-condition__radio {
    border-color: var(--red);
  }

  .jr-condition__radio i {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--red);
  }

  .jr-condition__copy {
    min-width: 0;
  }

  .jr-condition__copy strong {
    font-family: "Archivo", Arial, sans-serif;
    font-size: 14px;
  }

  .jr-condition__copy small {
    display: inline-block;
    margin-left: 8px;
    padding: 3px 7px;
    border-radius: 99px;
    background: #f0f0ed;
    color: #696965;
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  .jr-condition__copy > span {
    display: block;
    margin-top: 5px;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.45;
  }

  .jr-issue {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    min-height: 46px;
    padding: 11px 13px;
    border: 1px solid #dededb;
    border-radius: 11px;
    background: #fff;
    color: var(--ink);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .jr-issue.is-active {
    border-color: var(--red);
    background: #fff8f7;
  }

  .jr-checkbox {
    display: grid;
    flex: 0 0 20px;
    width: 20px;
    height: 20px;
    place-items: center;
    border: 1.5px solid #b5b5b1;
    border-radius: 5px;
    color: #fff;
  }

  .jr-issue.is-active .jr-checkbox {
    border-color: var(--red);
    background: var(--red);
  }

  .jr-checkbox svg {
    width: 14px;
    height: 14px;
  }

  .jr-quantity {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 25px;
    margin: 17px 0;
    padding: 20px 22px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: #fff;
  }

  .jr-quantity h3 {
    margin: 6px 0 4px;
    font-family: "Archivo", Arial, sans-serif;
    font-size: 16px;
  }

  .jr-quantity p {
    margin: 0;
    color: var(--muted);
    font-size: 11px;
    line-height: 1.4;
  }

  .jr-counter {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .jr-counter button {
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    border: 1px solid #d3d3cf;
    border-radius: 50%;
    background: #fff;
    color: var(--ink);
    font-size: 19px;
    cursor: pointer;
  }

  .jr-counter button:last-child {
    border-color: var(--red);
    background: var(--red);
    color: #fff;
  }

  .jr-counter strong {
    min-width: 20px;
    text-align: center;
    font-family: "Archivo", Arial, sans-serif;
    font-size: 18px;
  }

  .jr-accordions {
    overflow: hidden;
    margin-top: 24px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: #fff;
  }

  .jr-accordion__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    width: 100%;
    padding: 18px 20px;
    border: 0;
    border-bottom: 1px solid #ededeb;
    background: #fff;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .jr-accordion__trigger:last-of-type {
    border-bottom: 0;
  }

  .jr-accordion__trigger > span {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .jr-accordion__trigger strong {
    font-size: 13px;
  }

  .jr-accordion__trigger small {
    color: var(--muted);
    font-size: 10px;
  }

  .jr-accordion__trigger svg {
    width: 19px;
    height: 19px;
    transition: transform 160ms ease;
  }

  .jr-terms {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 18px 20px 22px;
    border-bottom: 1px solid #ededeb;
    list-style: none;
  }

  .jr-terms li {
    display: grid;
    grid-template-columns: 25px minmax(0, 1fr);
    gap: 8px;
  }

  .jr-terms li > span {
    color: var(--red);
    font-family: "Archivo", Arial, sans-serif;
    font-size: 10px;
    font-weight: 800;
  }

  .jr-terms p {
    margin: 0;
    color: var(--muted);
    font-size: 10.5px;
    line-height: 1.55;
  }

  .jr-lines {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    padding: 18px 20px 22px;
    border-top: 1px solid #ededeb;
  }

  .jr-lines a,
  .jr-lines div {
    padding: 11px 12px;
    border: 1px solid #e3e3df;
    border-radius: 10px;
    color: var(--ink);
    text-decoration: none;
  }

  .jr-lines strong,
  .jr-lines span {
    display: block;
  }

  .jr-lines strong {
    font-size: 11px;
  }

  .jr-lines span {
    margin-top: 3px;
    color: var(--red);
    font-size: 9px;
  }

  .jr-summary {
    position: sticky;
    top: 28px;
    display: grid;
    gap: 13px;
  }

  .jr-summary__card {
    overflow: hidden;
    min-height: 405px;
    padding: 24px;
    border: 1px solid #242424;
    border-radius: 20px;
    background:
      radial-gradient(circle at 90% 0%, rgba(214,40,30,.24), transparent 30%),
      #111;
    color: #fff;
    box-shadow: 0 18px 50px rgba(15,15,15,.13);
  }

  .jr-summary__card.has-quote {
    background:
      radial-gradient(circle at 96% 0%, rgba(255,255,255,.15), transparent 22%),
      linear-gradient(145deg, #d72a20 0%, #ad1710 58%, #740905 100%);
    border-color: transparent;
  }

  .jr-summary__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
  }

  .jr-summary__top .jr-kicker {
    color: #ffaaa4;
  }

  .jr-summary__top button {
    padding: 0;
    border: 0;
    background: none;
    color: rgba(255,255,255,.72);
    font-size: 10px;
    text-decoration: underline;
    cursor: pointer;
  }

  .jr-summary__empty {
    display: flex;
    min-height: 335px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .jr-summary__ring {
    display: grid;
    width: 86px;
    height: 86px;
    margin-bottom: 20px;
    place-items: center;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 50%;
    background: rgba(255,255,255,.04);
    box-shadow: inset 0 0 0 8px rgba(255,255,255,.025);
  }

  .jr-summary__ring span {
    font-family: "Archivo", Arial, sans-serif;
    font-size: 18px;
    font-weight: 800;
  }

  .jr-summary__empty h3 {
    margin: 0 0 9px;
    font-family: "Archivo", Arial, sans-serif;
    font-size: 19px;
  }

  .jr-summary__empty p {
    max-width: 270px;
    margin: 0;
    color: #a9a9a9;
    font-size: 11px;
    line-height: 1.55;
  }

  .jr-summary__empty ul {
    display: grid;
    gap: 8px;
    width: 100%;
    margin: 24px 0 0;
    padding: 18px 0 0;
    border-top: 1px solid rgba(255,255,255,.1);
    list-style: none;
    text-align: left;
  }

  .jr-summary__empty li {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #d1d1d1;
    font-size: 10px;
  }

  .jr-summary__empty li svg {
    width: 14px;
    height: 14px;
    color: #E8402F;
  }

  .jr-estimate {
    padding: 31px 0 24px;
  }

  .jr-estimate span,
  .jr-estimate small {
    display: block;
  }

  .jr-estimate span {
    color: rgba(255,255,255,.72);
    font-size: 11px;
  }

  .jr-estimate strong {
    display: block;
    margin: 8px 0 4px;
    font-family: "Archivo", Arial, sans-serif;
    font-size: clamp(34px, 4vw, 48px);
    line-height: .98;
    letter-spacing: -0.06em;
  }

  .jr-estimate small {
    color: rgba(255,255,255,.75);
    font-size: 10px;
  }

  .jr-summary__device {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    border-top: 1px solid rgba(255,255,255,.2);
    border-left: 1px solid rgba(255,255,255,.2);
  }

  .jr-summary__device div {
    min-height: 67px;
    padding: 12px;
    border-right: 1px solid rgba(255,255,255,.2);
    border-bottom: 1px solid rgba(255,255,255,.2);
  }

  .jr-summary__device span,
  .jr-summary__device strong {
    display: block;
  }

  .jr-summary__device span {
    margin-bottom: 5px;
    color: rgba(255,255,255,.65);
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  .jr-summary__device strong {
    overflow: hidden;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .jr-whatsapp {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    width: 100%;
    min-height: 50px;
    margin-top: 18px;
    border-radius: 999px;
    background: #fff;
    color: #8c0d08;
    font-family: "Archivo", Arial, sans-serif;
    font-size: 12px;
    font-weight: 800;
    text-decoration: none;
    box-shadow: 0 8px 24px rgba(69,0,0,.2);
  }

  .jr-whatsapp svg {
    width: 19px;
    height: 19px;
  }

  .jr-disclaimer {
    margin: 13px 0 0;
    color: rgba(255,255,255,.67);
    font-size: 9px;
    line-height: 1.45;
    text-align: center;
  }

  .jr-store-card {
    display: flex;
    gap: 13px;
    padding: 17px;
    border: 1px solid var(--line);
    border-radius: 15px;
    background: #fff;
  }

  .jr-store-card__pin {
    display: grid;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 50% 50% 50% 4px;
    background: var(--red);
    color: #fff;
    font-family: "Archivo", Arial, sans-serif;
    font-size: 13px;
    font-weight: 900;
    transform: rotate(-45deg);
  }

  .jr-store-card__pin::first-letter {
    transform: rotate(45deg);
  }

  .jr-store-card strong {
    font-size: 11px;
  }

  .jr-store-card p {
    margin: 5px 0 0;
    color: var(--muted);
    font-size: 9.5px;
    line-height: 1.45;
  }

  .jr-mobile-result {
    display: none;
  }

  .jr-footer {
    padding: 36px 0;
    border-top: 1px solid #252525;
    background: var(--black);
    color: #fff;
  }

  .jr-footer .jr-shell {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 35px;
  }

  .jr-brandmark--footer .jr-brandmark__word {
    color: #fff;
  }

  .jr-footer p {
    margin: 0;
    color: #9d9d9d;
    font-size: 11px;
  }

  .jr-footer small {
    color: #737373;
    font-size: 9px;
  }

  @media (max-width: 980px) {
    .jr-hero {
      grid-template-columns: minmax(0, 1fr) 310px;
      gap: 30px;
    }

    .jr-main {
      grid-template-columns: minmax(0, 1fr) 330px;
    }

    .jr-trust-row {
      grid-template-columns: 1fr;
    }

    .jr-trust-row div {
      min-height: 0;
    }
  }

  @media (max-width: 820px) {
    .jr-shell {
      width: min(100% - 28px, 700px);
    }

    .jr-topbar__location,
    .jr-nav__meta {
      display: none;
    }

    .jr-hero {
      grid-template-columns: 1fr;
      min-height: 0;
      padding-top: 42px;
      padding-bottom: 45px;
    }

    .jr-hero__visual {
      display: none;
    }

    .jr-hero h1 {
      max-width: 650px;
      font-size: clamp(42px, 11vw, 64px);
    }

    .jr-trust-row {
      grid-template-columns: repeat(3, 1fr);
    }

    .jr-main {
      display: block;
      padding-top: 32px;
      padding-bottom: 110px;
    }

    .jr-summary {
      position: static;
      margin-top: 18px;
    }

    .jr-summary__card {
      min-height: 0;
    }

    .jr-summary__empty {
      min-height: 270px;
    }

    .jr-mobile-result {
      position: fixed;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 80;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      padding: 11px 16px calc(11px + env(safe-area-inset-bottom));
      border-top: 1px solid rgba(255,255,255,.14);
      background: rgba(14,14,14,.96);
      color: #fff;
      backdrop-filter: blur(14px);
    }

    .jr-mobile-result span,
    .jr-mobile-result strong {
      display: block;
    }

    .jr-mobile-result span {
      color: #aaa;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .jr-mobile-result strong {
      margin-top: 3px;
      font-family: "Archivo", Arial, sans-serif;
      font-size: 21px;
      letter-spacing: -.04em;
    }

    .jr-mobile-result a {
      padding: 12px 18px;
      border-radius: 999px;
      background: var(--red);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      text-decoration: none;
    }

    .jr-footer .jr-shell {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }

  @media (max-width: 560px) {
    .jr-shell {
      width: min(100% - 22px, 520px);
    }

    .jr-nav {
      min-height: 66px;
    }

    .jr-brandmark__word {
      font-size: 18px;
    }

    .jr-brandmark__divider,
    .jr-brandmark__relife {
      display: none;
    }

    .jr-hero {
      padding-top: 34px;
      padding-bottom: 36px;
    }

    .jr-hero h1 {
      margin: 14px 0 14px;
      font-size: 41px;
    }

    .jr-hero__copy > p {
      font-size: 14px;
      line-height: 1.55;
    }

    .jr-trust-row {
      grid-template-columns: 1fr;
      margin-top: 24px;
    }

    .jr-trust-row div {
      min-height: 0;
      padding: 13px 15px;
    }

    .jr-intro {
      align-items: start;
    }

    .jr-intro h2 {
      font-size: 25px;
    }

    .jr-completion {
      padding-top: 4px;
      white-space: nowrap;
    }

    .jr-step {
      border-radius: 15px;
    }

    .jr-step__head {
      padding: 17px 16px 14px;
    }

    .jr-step__body {
      padding: 16px;
    }

    .jr-brand-grid,
    .jr-two-choice {
      grid-template-columns: 1fr;
    }

    .jr-model-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      max-height: 330px;
    }

    .jr-choice-row {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .jr-quantity {
      align-items: flex-start;
      padding: 17px;
    }

    .jr-lines {
      grid-template-columns: 1fr;
    }

    .jr-summary__card {
      padding: 20px;
    }

    .jr-footer {
      padding-bottom: 96px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
