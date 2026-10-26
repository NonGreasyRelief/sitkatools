# Tens demo DB — answer key (built 2026-10-26)

DB file: `Tens-DB-26-10-26.json`. Load it with SitkaTools' 📂 Load DB and open 👥 Labour & Cost Wizard → 📊 Reports → 💲 Costs.
These numbers are worked out from the inputs by this script on its own, not by the Labour & Cost Wizard. If the page differs, one of them splits something differently.

## Inputs

| What | Value |
|---|---|
| Buildings | Building 1 (Nursery): Mother Room, Clone Room, Veg Room, Grow 1, Grow 2, Dry Room 1 · Building 2 (Flower): Grow 3, Grow 4, Dry Room 2 |
| Rent | $10,000 a month per building, spread over each month's days, shared by plants |
| Lights | 10 lights × 1,000 W in every room except the dry rooms = 10 kW → 180 kWh a veg day (18 h), 120 kWh a bloom day (12 h) |
| Dehumidifier | 1 in each dry room, 1,000 W × 10 h = 10 kWh a day |
| Electricity | $10 per kWh (estimated usage) |
| Water | $10 per 1,000 L |
| Fertilizer | Grow A, $10 per L |
| Grow log, per plant per day | 1 L water, 100 mL Grow A, 1 L runoff, light 100 % |
| Mother lot | M100: 100 plants, Day 0 2025-11-24, Mother Room from 2025-12-22, retires 2026-12-08 (still growing today) |
| Bloom lots | L101–L110: 1,000 clones each from M100, default recipe's tasks (20-day veg, 63-day bloom), 10 days drying (Bucking 10 days after Harvest; the built-in now dries 12), 10 days trimming |
| Labour | 10 employees × $10/h; every day of every task gets 5 h |
| Yield | 100,000 g flower per lot (wet 1,000,000 g, dry 110,000 g, trim 10,000 g) |
| Supplies | clone cube $1 per plant at Cutting Clones · coco block $10 per plant at Transplanting · 10 trellis nets × $10 per crop · mother pot $10 per mother plant |

## One bloom lot, day by day

Every bloom lot runs the same 120 days (L101: 2026-01-23 → 2026-05-22):

| Where | Days | Lights | kWh |
|---|---|---|---|
| Clone Room (Day 0 → day before Planting) | 14 | 18 h | 2,520 |
| Veg Room (Planting → day before Transplanting) | 16 | 18 h | 2,880 |
| Grow room before Flip | 4 | 18 h | 720 |
| Grow room Flip → Harvest | 64 | 12 h | 7,680 |
| Dry room (day after Harvest → Weigh & Ship) | 22 | dark | dehumidifier 10/day = 220 |

- **Lights:** 13,800 kWh × $10 = **$138,000.00**. Plus the dry room's dehumidifier while drying (220 kWh = $2,200.00), plus a share of an empty dry room's dehumidifier on other days (by plants).
- **Water:** 97 grow-log days with plants × 1,000 L = 97,000 L × $10/1,000 L = **$970.00**.
- **Fertilizer:** 97 days × 100 L = 9,700 L × $10 = **$97,000.00**.
- **Labour:** 39 task days × 5 h = 195 h × $10 = **$1,950.00**.
- **Supplies:** Clone cube × 1,000 plants at Cutting Clones = $1,000.00 · Coco block × 1,000 plants at Transplanting = $10,000.00 · Trellis net × 10 per crop = $100.00 → **$11,100.00**.
- **Property:** each day, its building's rent for that day (monthly ÷ days in the month) × its plants ÷ all plants in the building that day. It changes lot by lot with who else is in the building.
- **Double entries:** PaperWizard saves a phase or room change day on two pages. Transplanting (room change) and Flip (phase change) are on two pages in this DB, as PaperWizard stores them: the old page's row has the day's water and fertilizer, the new page's row leaves them blank (the receiving side doesn't enter them). So each day's water counts once.

## The mothers and the cost per clone

M100 has 100 plants from 2025-11-24 to today (337 days). Ten lots × 1,000 clones = **10,000 clones** cut from it. Cost per clone = everything spent on the mothers so far ÷ 10,000.

| Part | Mothers so far | How | Per clone | Per lot (× 1,000 clones) |
|---|---|---|---|---|
| Labour | $1,850.00 | 37 task days × 5 h × $10 | $0.1850 | $185.00 |
| Electricity | $614,979.72 | lights 60,660 kWh (337 days × 180 kWh) + dehumidifier share 838.0 kWh, × $10 | $61.4980 | $61,497.97 |
| Water | $337.00 | 33,700 L | $0.0337 | $33.70 |
| Fertilizer | $33,700.00 | 3,370 L Grow A | $3.3700 | $3,370.00 |
| Supplies | $1,000.00 | Mother pot × 100 plants at the start | $0.1000 | $100.00 |
| Property | $28,679.92 | share of Building 1's rent by plants over 337 days | $2.8680 | $2,867.99 |
| **All in** | **$680,546.64** | | **$68.0547** | **$68,054.66** |

The mothers keep costing until they retire, so the cost per clone grows each day until more lots are cut. Each lot also pays its own cutting (its ✂️ Cutting Clones hours and clone cubes), already in its own labour and supplies.

## Every bloom lot

Own costs, then the clones (at the cost per clone above). Property and the dehumidifier share differ lot by lot; the rest is the same for every lot.

| Lot | Room | Ships | Labour | Electricity (kWh) | Water | Fertilizer | Supplies | Property (rent days) | Own total | + Clones | **All in** | **$/g** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L101 | Grow 1 | 2026-05-22 | $1,950.00 | $144,530.70 (14,453) | $970.00 | $97,000.00 | $11,100.00 | $16,170.30 (120) | $271,721.00 | $68,054.66 | **$339,775.67** | **$3.3978** |
| L102 | Grow 3 | 2026-06-08 | $1,950.00 | $146,594.24 (14,659) | $970.00 | $97,000.00 | $11,100.00 | $23,683.48 (120) | $281,297.72 | $68,054.66 | **$349,352.38** | **$3.4935** |
| L103 | Grow 2 | 2026-06-26 | $1,950.00 | $142,460.91 (14,246) | $970.00 | $97,000.00 | $11,100.00 | $10,553.77 (120) | $264,034.68 | $68,054.66 | **$332,089.35** | **$3.3209** |
| L104 | Grow 4 | 2026-07-13 | $1,950.00 | $143,373.33 (14,337) | $970.00 | $97,000.00 | $11,100.00 | $15,441.62 (120) | $269,834.95 | $68,054.66 | **$337,889.61** | **$3.3789** |
| L105 | Grow 1 | 2026-07-31 | $1,950.00 | $141,587.88 (14,159) | $970.00 | $97,000.00 | $11,100.00 | $9,527.56 (120) | $262,135.44 | $68,054.66 | **$330,190.11** | **$3.3019** |
| L106 | Grow 3 | 2026-08-17 | $1,950.00 | $141,768.29 (14,177) | $970.00 | $97,000.00 | $11,100.00 | $13,628.80 (120) | $266,417.09 | $68,054.66 | **$334,471.76** | **$3.3447** |
| L107 | Grow 2 | 2026-09-04 | $1,950.00 | $141,484.67 (14,148) | $970.00 | $97,000.00 | $11,100.00 | $11,966.08 (120) | $264,470.75 | $68,054.66 | **$332,525.41** | **$3.3253** |
| L108 | Grow 4 | 2026-09-21 | $1,950.00 | $141,768.29 (14,177) | $970.00 | $97,000.00 | $11,100.00 | $14,732.95 (120) | $267,521.25 | $68,054.66 | **$335,575.91** | **$3.3558** |
| L109 | Grow 1 | 2026-10-09 | $1,950.00 | $142,333.67 (14,233) | $970.00 | $97,000.00 | $11,100.00 | $19,835.95 (120) | $273,189.62 | $68,054.66 | **$341,244.28** | **$3.4124** |
| L110 | Grow 3 | 2026-10-26 | $1,950.00 | $142,418.29 (14,242) | $970.00 | $97,000.00 | $11,100.00 | $21,661.29 (120) | $275,099.58 | $68,054.66 | **$343,154.25** | **$3.4315** |

## 💲 Cost per gram — Period: Last 6 months (2026-04-27 → 2026-10-26)

Lots shipped (✅ Weigh & Ship signed off) in the period: 10 → 1,000,000 g of flower.
- Building 1 (Nursery) held a crop every day of the period: no idle days.
- Building 2 (Flower) held a crop every day of the period: no idle days.
- No daily chores or equipment hours: shared labour is $0, so labour direct = fully loaded.

| Part | $ (the lots + their clones) | + idle building days | ÷ grams | **$ per gram** |
|---|---|---|---|---|
| Labour | $21,350.00 | — | 1,000,000 | **$0.0214** |
| Electricity | $2,043,300.00 | — | 1,000,000 | **$2.0433** |
| Water | $10,037.00 | — | 1,000,000 | **$0.0100** |
| Fertilizer | $1,003,700.00 | — | 1,000,000 | **$1.0037** |
| Supplies | $112,000.00 | — | 1,000,000 | **$0.1120** |
| Property | $185,881.72 | — | 1,000,000 | **$0.1859** |
| **Cost / g (all in)** | | | | **$3.3763** |

**🏢 By building** (each building's lots, plus its own idle days):

| Building | Lots | Grams | Labour | Electricity | Water | Fertilizer | Supplies | Property | **All in** |
|---|---|---|---|---|---|---|---|---|---|
| Building 1 (Nursery) | L101, L103, L105, L107, L109 | 500,000 | $0.0214 | $2.0398 | $0.0100 | $1.0037 | $0.1120 | $0.1648 | **$3.3516** |
| Building 2 (Flower) | L102, L104, L106, L108, L110 | 500,000 | $0.0214 | $2.0468 | $0.0100 | $1.0037 | $0.1120 | $0.2070 | **$3.4009** |

**🏢 What each building cost to run in the period** (only 2026-04-27 → 2026-10-26: 2026-04 counts from the 27th):

| Building | Labour | Electricity | Water | Fertilizer | Supplies | Property | **Total** | 2026-04 only |
|---|---|---|---|---|---|---|---|---|
| Building 1 (Nursery) | $9,650.00 | $919,500.00 | $4,093.00 | $409,300.00 | $34,400.00 | $59,720.43 | **$1,436,663.43** | $48,587.33 |
| Building 2 (Flower) | $7,200.00 | $362,700.00 | $2,760.00 | $276,000.00 | $30,000.00 | $59,720.43 | **$738,380.43** | $19,413.33 |

## 💲 Cost per gram — Period: Last 12 months (2025-10-27 → 2026-10-26)

Lots shipped (✅ Weigh & Ship signed off) in the period: 10 → 1,000,000 g of flower.
- Building 1 (Nursery) held a crop every day of the period: no idle days.
- Building 2 (Flower) held no crop on 107 days of the period: rent $35,559.14 + its dehumidifier 1,070 kWh = $10,700.00, spread over the grams it shipped.
- No daily chores or equipment hours: shared labour is $0, so labour direct = fully loaded.

| Part | $ (the lots + their clones) | + idle building days | ÷ grams | **$ per gram** |
|---|---|---|---|---|
| Labour | $21,350.00 | — | 1,000,000 | **$0.0214** |
| Electricity | $2,043,300.00 | $10,700.00 | 1,000,000 | **$2.0540** |
| Water | $10,037.00 | — | 1,000,000 | **$0.0100** |
| Fertilizer | $1,003,700.00 | — | 1,000,000 | **$1.0037** |
| Supplies | $112,000.00 | — | 1,000,000 | **$0.1120** |
| Property | $185,881.72 | $35,559.14 | 1,000,000 | **$0.2214** |
| **Cost / g (all in)** | | | | **$3.4225** |

**🏢 By building** (each building's lots, plus its own idle days):

| Building | Lots | Grams | Labour | Electricity | Water | Fertilizer | Supplies | Property | **All in** |
|---|---|---|---|---|---|---|---|---|---|
| Building 1 (Nursery) | L101, L103, L105, L107, L109 | 500,000 | $0.0214 | $2.0398 | $0.0100 | $1.0037 | $0.1120 | $0.1648 | **$3.3516** |
| Building 2 (Flower) | L102, L104, L106, L108, L110 | 500,000 | $0.0214 | $2.0682 | $0.0100 | $1.0037 | $0.1120 | $0.2781 | **$3.4934** |

**🏢 What each building cost to run in the period** (only 2025-10-27 → 2026-10-26: 2025-10 counts from the 27th):

| Building | Labour | Electricity | Water | Fertilizer | Supplies | Property | **Total** | 2025-10 only |
|---|---|---|---|---|---|---|---|---|
| Building 1 (Nursery) | $13,100.00 | $1,600,300.00 | $6,687.00 | $668,700.00 | $62,000.00 | $110,720.43 | **$2,461,507.43** | — |
| Building 2 (Flower) | $8,250.00 | $453,700.00 | $3,350.00 | $335,000.00 | $50,000.00 | $110,720.43 | **$961,020.43** | — |

## 🏢 What each building costs to run, by month

Every $ spent in the building, whoever carries it (lots, mothers, idle days). Rent is the building's whole $10,000 every full month. These are whole months; the page counts only the period's days, so a month the period starts partway through shows only those days (see each period above).

| Month | Building | Labour | Electricity | Water | Fertilizer | Supplies | Property | **Total** |
|---|---|---|---|---|---|---|---|---|
| 2025-11 | Building 1 (Nursery) | $50.00 | $13,300.00 | $7.00 | $700.00 | $1,000.00 | $2,333.33 | **$17,390.33** |
| 2025-11 | Building 2 (Flower) | $0.00 | $700.00 | $0.00 | $0.00 | $0.00 | $2,333.33 | **$3,033.33** |
| 2025-12 | Building 1 (Nursery) | $150.00 | $58,900.00 | $31.00 | $3,100.00 | $0.00 | $10,000.00 | **$72,181.00** |
| 2025-12 | Building 2 (Flower) | $0.00 | $3,100.00 | $0.00 | $0.00 | $0.00 | $10,000.00 | **$13,100.00** |
| 2026-01 | Building 1 (Nursery) | $200.00 | $75,100.00 | $121.00 | $12,100.00 | $1,100.00 | $10,000.00 | **$98,621.00** |
| 2026-01 | Building 2 (Flower) | $0.00 | $3,100.00 | $0.00 | $0.00 | $0.00 | $10,000.00 | **$13,100.00** |
| 2026-02 | Building 1 (Nursery) | $1,050.00 | $141,400.00 | $528.00 | $52,800.00 | $12,200.00 | $10,000.00 | **$217,978.00** |
| 2026-02 | Building 2 (Flower) | $0.00 | $2,800.00 | $0.00 | $0.00 | $0.00 | $10,000.00 | **$12,800.00** |
| 2026-03 | Building 1 (Nursery) | $1,050.00 | $198,700.00 | $911.00 | $91,100.00 | $11,100.00 | $10,000.00 | **$312,861.00** |
| 2026-03 | Building 2 (Flower) | $400.00 | $30,700.00 | $210.00 | $21,000.00 | $10,000.00 | $10,000.00 | **$72,310.00** |
| 2026-04 | Building 1 (Nursery) | $1,050.00 | $225,000.00 | $1,150.00 | $115,000.00 | $2,200.00 | $10,000.00 | **$354,400.00** |
| 2026-04 | Building 2 (Flower) | $650.00 | $60,600.00 | $460.00 | $46,000.00 | $10,000.00 | $10,000.00 | **$127,710.00** |
| 2026-05 | Building 1 (Nursery) | $2,350.00 | $226,900.00 | $1,151.00 | $115,100.00 | $12,200.00 | $10,000.00 | **$367,701.00** |
| 2026-05 | Building 2 (Flower) | $1,200.00 | $77,500.00 | $590.00 | $59,000.00 | $10,000.00 | $10,000.00 | **$158,290.00** |
| 2026-06 | Building 1 (Nursery) | $2,350.00 | $219,000.00 | $1,100.00 | $110,000.00 | $12,200.00 | $10,000.00 | **$354,650.00** |
| 2026-06 | Building 2 (Flower) | $1,200.00 | $75,000.00 | $570.00 | $57,000.00 | $10,000.00 | $10,000.00 | **$153,770.00** |
| 2026-07 | Building 1 (Nursery) | $2,050.00 | $203,500.00 | $1,011.00 | $101,100.00 | $10,000.00 | $10,000.00 | **$327,661.00** |
| 2026-07 | Building 2 (Flower) | $1,400.00 | $76,900.00 | $590.00 | $59,000.00 | $10,000.00 | $10,000.00 | **$157,890.00** |
| 2026-08 | Building 1 (Nursery) | $1,250.00 | $111,700.00 | $461.00 | $46,100.00 | $0.00 | $10,000.00 | **$169,511.00** |
| 2026-08 | Building 2 (Flower) | $1,350.00 | $76,900.00 | $600.00 | $60,000.00 | $0.00 | $10,000.00 | **$148,850.00** |
| 2026-09 | Building 1 (Nursery) | $900.00 | $77,400.00 | $190.00 | $19,000.00 | $0.00 | $10,000.00 | **$107,490.00** |
| 2026-09 | Building 2 (Flower) | $1,050.00 | $39,000.00 | $300.00 | $30,000.00 | $0.00 | $10,000.00 | **$80,350.00** |
| 2026-10 | Building 1 (Nursery) | $650.00 | $49,400.00 | $26.00 | $2,600.00 | $0.00 | $8,387.10 | **$61,063.10** |
| 2026-10 | Building 2 (Flower) | $1,000.00 | $7,400.00 | $30.00 | $3,000.00 | $0.00 | $8,387.10 | **$19,817.10** |

## Days to watch

- **Building 2 before its first crop:** the mothers start 2025-11-24 (the first day anything is costed), and Building 2 gets its first lot on 2026-03-11 (L102 transplanted to Grow 3). Those 107 days are idle: in the 12-month view they add Building 2's rent and dehumidifier to its grams; the 6-month view starts after them.
- **Empty dry rooms:** on days no lot is drying, the dehumidifier's 10 kWh goes to the building's other lots by plants (the mothers included, in Building 1).
- **Rent split by plants:** in Building 1 the mothers (100 plants) take 100 / (100 + 1,000 × lots there that day) of the day's rent; each bloom lot 1,000 / that. Switch ⚡ Power & Rates → Property to **Floor area** (every room 1,000 sq ft) to split it room by room instead.
- **Double entries:** Transplanting and Flip days are on two grow-log pages (as PaperWizard does); water and fertilizer are only on the old page's row.
