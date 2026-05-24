import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  Camera,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Scale,
  Footprints,
  Moon,
  Heart,
  Search,
  Smartphone,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const GOALS = { kcal: 2230, protein: 160, carbs: 140, fat: 75 };
const TARGET_WEIGHT = 73;
const COLORS = { kcal: "#1c1917", protein: "#0ea5e9", carbs: "#10b981", fat: "#f43f5e" };

const COMMON_FOODS = [
  { name: "Pollo", amount: "300g", kcal: 495, protein: 69, carbs: 0, fat: 22, aliases: ["pollo", "pechuga"] },
  { name: "Huevos", amount: "2 uds", kcal: 160, protein: 14, carbs: 1, fat: 11, aliases: ["huevo", "huevos"] },
  { name: "Avena", amount: "35g", kcal: 131, protein: 5, carbs: 22, fat: 2, aliases: ["avena"] },
  { name: "Leche desnatada", amount: "300ml", kcal: 105, protein: 10, carbs: 15, fat: 0, aliases: ["leche", "desnatada"] },
  { name: "Yogur natural", amount: "2 uds", kcal: 150, protein: 8, carbs: 12, fat: 7, aliases: ["yogur", "yogures"] },
  { name: "Arándanos", amount: "100g", kcal: 57, protein: 1, carbs: 14, fat: 0, aliases: ["arandanos", "arándanos"] },
];

function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isoForDate(dateInput) {
  const date = new Date(dateInput);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getAmount(text) {
  const lower = text.toLowerCase();
  const match = lower.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramos|ml|l|uds|ud|huevos?)/i);
  if (!match) return { amount: 100, unit: "g" };

  let amount = Number(match[1].replace(",", "."));
  let unit = match[2].toLowerCase();
  if (unit === "kg" || unit === "l") amount *= 1000;
  if (unit.includes("huevo") || unit.includes("ud")) unit = "ud";
  return { amount, unit };
}

function trainingTypeForDate(date) {
  const day = date.getDay();
  if (day === 1 || day === 4) return "Push";
  if (day === 2 || day === 5) return "Pull";
  return "Rest";
}

function weekKeyFromDate(dateString) {
  const d = new Date(dateString + "T12:00:00");
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return isoForDate(d);
}

function isWeekend(dateString) {
  const d = new Date(dateString + "T12:00:00");
  return d.getDay() === 0 || d.getDay() === 6;
}

function sleepInfo(hours) {
  if (!hours) return { score: 0, label: "sin datos", msg: "Mete tus horas de sueño para calcular calidad.", cls: "bg-stone-100 text-stone-600" };
  if (hours < 5.5) return { score: 35, label: "malo", msg: "Muy poco sueño: peor recuperación, hambre y rendimiento.", cls: "bg-red-50 text-red-700" };
  if (hours < 6.5) return { score: 60, label: "justo", msg: "Aceptable pero justo. Intenta acercarte a 7-8h.", cls: "bg-yellow-50 text-yellow-800" };
  if (hours <= 8.5) return { score: 90, label: "bueno", msg: "Buen rango para recuperación, entreno y control del hambre.", cls: "bg-green-50 text-green-700" };
  return { score: 75, label: "mucho", msg: "Mucho sueño. Si te levantas pesado, revisa horario/calidad.", cls: "bg-blue-50 text-blue-700" };
}
function screenInfo(hours) {
  if (!hours) {
    return {
      score: 0,
      label: "sin datos",
      msg: "Mete el tiempo de uso del móvil.",
      cls: "bg-stone-100 text-stone-600",
    };
  }

  if (hours <= 2.5) {
    return {
      score: 100,
      label: "perfecto",
      msg: "Has cumplido el objetivo.",
      cls: "bg-green-50 text-green-700",
    };
  }

  if (hours <= 4) {
    return {
      score: 70,
      label: "aceptable",
      msg: "Te has pasado un poco.",
      cls: "bg-yellow-50 text-yellow-800",
    };
  }

  return {
    score: 30,
    label: "alto",
    msg: "Demasiado tiempo de móvil.",
    cls: "bg-red-50 text-red-700",
  };
}
async function searchOpenFoodFacts(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=6&fields=product_name,brands,nutriments`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo buscar online");
  const data = await res.json();
  return (data.products || [])
    .filter((p) => p.nutriments)
    .map((p) => ({
      name: p.product_name || query,
      brand: p.brands || "",
      kcal100: p.nutriments["energy-kcal_100g"] ?? (p.nutriments.energy_100g ? Math.round(p.nutriments.energy_100g / 4.184) : null),
      protein100: p.nutriments.proteins_100g ?? 0,
      carbs100: p.nutriments.carbohydrates_100g ?? 0,
      fat100: p.nutriments.fat_100g ?? 0,
    }))
    .filter((p) => p.kcal100 !== null && !Number.isNaN(Number(p.kcal100)));
}

export default function App() {
  const [activeTab, setActiveTab] = useState("progress");
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const [foodsByDate, setFoodsByDate] = useState(() => load("foodsByDate", {}));
  const [foodInput, setFoodInput] = useState("");
  const [foodSearch, setFoodSearch] = useState("");
  const [foodResults, setFoodResults] = useState([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState("");

  const [trainingLogs, setTrainingLogs] = useState(() => load("trainingLogs", {}));
  const [steps, setSteps] = useState("");

  const [weights, setWeights] = useState(() => load("weights", []));
  const [weight, setWeight] = useState("");
  const [photos, setPhotos] = useState(() => load("photos", []));
  const [bodyfat, setBodyfat] = useState("13-15% aprox.");

  const [sleepLogs, setSleepLogs] = useState(() => load("sleepLogs", {}));
  const [sleepHours, setSleepHours] = useState("");

  const [masturbationLogs, setMasturbationLogs] = useState(() => load("masturbationLogs", {}));

  const [screenLogs, setScreenLogs] = useState(() => load("screenLogs", {}));
  const [screenHours, setScreenHours] = useState("");

  const foods = foodsByDate[selectedDate] || [];
  const selectedTraining = trainingLogs[selectedDate] || { gymDone: false, steps: 0 };
  const selectedSleep = sleepLogs[selectedDate] || { hours: 0 };

  const selectedScreen = screenLogs[selectedDate] || { hours: 0 };

  useEffect(() => save("foodsByDate", foodsByDate), [foodsByDate]);
  useEffect(() => save("trainingLogs", trainingLogs), [trainingLogs]);
  useEffect(() => save("weights", weights), [weights]);
  useEffect(() => save("photos", photos), [photos]);
  useEffect(() => save("sleepLogs", sleepLogs), [sleepLogs]);
  useEffect(() => save("masturbationLogs", masturbationLogs), [masturbationLogs]);
  useEffect(() => save("screenLogs", screenLogs), [screenLogs]);

  const totals = useMemo(() => foods.reduce((acc, f) => ({ kcal: acc.kcal + f.kcal, protein: acc.protein + f.protein, carbs: acc.carbs + f.carbs, fat: acc.fat + f.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }), [foods]);

  const successToday = totals.kcal >= GOALS.kcal * 0.9 && totals.kcal <= GOALS.kcal * 1.1 && totals.protein >= GOALS.protein * 0.9;
  const currentWeight = weights[0]?.weight ? Number(weights[0].weight) : null;
  const startWeight = weights.length ? Number(weights[weights.length - 1].weight) : null;
  const lost = startWeight && currentWeight ? Math.max(startWeight - currentWeight, 0) : 0;
  const remainingKg = currentWeight ? Math.max(currentWeight - TARGET_WEIGHT, 0) : null;
  const progress = startWeight && currentWeight && startWeight > TARGET_WEIGHT ? Math.min(100, Math.max(0, ((startWeight - currentWeight) / (startWeight - TARGET_WEIGHT)) * 100)) : 0;
  const eatenText = foods.map((f) => f.name.toLowerCase()).join(" ");
  const recommendations = COMMON_FOODS.filter((food) => !food.aliases.some((a) => eatenText.includes(a))).slice(0, 5);
  const selectedSleepInfo = sleepInfo(Number(selectedSleep.hours || 0));
  const pajaWeek = getPajaWeek(selectedDate, masturbationLogs);
  const selectedScreenInfo = screenInfo(Number(selectedScreen.hours || 0));
  
  function setFoodsForSelected(updater) {
    setFoodsByDate((prev) => {
      const current = prev[selectedDate] || [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [selectedDate]: next };
    });
  }

  async function runFoodSearch() {
    if (!foodSearch.trim() && !foodInput.trim()) return;
    setFoodLoading(true);
    setFoodError("");
    try {
      const query = (foodSearch || foodInput).replace(/\d+(?:[.,]\d+)?\s*(kg|g|ml|l|uds|ud|huevos?)/gi, "").trim();
      const results = await searchOpenFoodFacts(query);
      setFoodResults(results);
      if (!results.length) setFoodError("No encontré datos fiables. Prueba marca + producto exacto.");
    } catch {
      setFoodError("No se pudo buscar online. Revisa internet o prueba otro nombre.");
    } finally {
      setFoodLoading(false);
    }
  }

  function addOnlineFood(result) {
    const { amount, unit } = getAmount(foodInput || "100g");
    const factor = unit === "ud" ? 1 : amount / 100;
    setFoodsForSelected((prev) => [...prev, {
      id: Date.now() + Math.random(),
      name: foodInput || `${amount}g ${result.name}`,
      detectedAs: result.name,
      kcal: Math.round(Number(result.kcal100) * factor),
      protein: Math.round(Number(result.protein100) * factor),
      carbs: Math.round(Number(result.carbs100) * factor),
      fat: Math.round(Number(result.fat100) * factor),
      source: "Open Food Facts",
    }]);
    setFoodInput("");
  }

  function quickAdd(food) {
    setFoodsForSelected((prev) => [...prev, { id: Date.now() + Math.random(), name: `${food.amount} ${food.name}`, kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat, source: "recomendación" }]);
  }

  function toggleGym() {
    setTrainingLogs((prev) => ({ ...prev, [selectedDate]: { ...selectedTraining, gymDone: !selectedTraining.gymDone } }));
  }

  function saveSteps() {
    setTrainingLogs((prev) => ({ ...prev, [selectedDate]: { ...selectedTraining, steps: Number(steps) || 0 } }));
    setSteps("");
  }

  function saveWeight() {
    if (!weight) return;
    setWeights((prev) => [{ date: selectedDate, weight }, ...prev.filter((w) => w.date !== selectedDate)]);
    setWeight("");
  }

  function savePhoto(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const estimate = ["12-14% aprox.", "13-15% aprox.", "14-16% aprox."][Math.floor(Math.random() * 3)];
      setBodyfat(estimate);
      setPhotos((prev) => [{ id: Date.now(), date: selectedDate, photo: reader.result, weight: currentWeight || "", bodyfat: estimate }, ...prev]);
    };
    reader.readAsDataURL(file);
  }

  function saveSleep() {
    setSleepLogs((prev) => ({ ...prev, [selectedDate]: { hours: Number(sleepHours) || 0 } }));
    setSleepHours("");
  }

  function togglePaja() {
    const current = masturbationLogs[selectedDate]?.done;
    setMasturbationLogs((prev) => ({ ...prev, [selectedDate]: { done: !current } }));
  }

  function saveScreenTime() {
  setScreenLogs((prev) => ({
    ...prev,
    [selectedDate]: {
      hours: Number(screenHours) || 0,
    },
  }));

  setScreenHours("");
}
  return (
    <div className="relative min-h-[100dvh] bg-[#f7f3ee] text-stone-950 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(7.75rem+env(safe-area-inset-bottom))] md:p-4 md:pb-32 overflow-x-hidden selection:bg-amber-200">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_0%,rgba(251,191,36,0.30),transparent_32%),radial-gradient(circle_at_95%_8%,rgba(14,165,233,0.20),transparent_30%),linear-gradient(180deg,#fffaf2_0%,#f7f3ee_52%,#f4efe7_100%)]" />
      <div className="pointer-events-none fixed -top-20 -left-24 -z-10 h-72 w-72 rounded-full bg-amber-200/35 blur-3xl" />
      <div className="pointer-events-none fixed top-16 -right-24 -z-10 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl" />

      <div className="w-full max-w-md md:max-w-5xl mx-auto space-y-4 md:space-y-6">
        <header className="rounded-[1.8rem] bg-white/72 backdrop-blur-2xl border border-white/80 p-4 shadow-[0_16px_45px_rgba(120,80,30,0.10)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-stone-500">definición diaria</p>
              <h1 className="text-[2.35rem] md:text-5xl font-black tracking-[-0.06em] leading-none bg-gradient-to-r from-stone-950 via-stone-700 to-amber-700 bg-clip-text text-transparent">Looksmaxxing</h1>
              <p className="text-stone-500 mt-2 text-sm leading-snug">Dieta · entreno · sueño · físico · móvil</p>
            </div>
            <div className="shrink-0 h-12 w-12 rounded-[1.35rem] bg-gradient-to-br from-stone-950 to-stone-700 text-white flex items-center justify-center shadow-xl shadow-stone-900/20 rotate-3 active:scale-95 transition">
              <Sparkles size={22} />
            </div>
          </div>
        </header>

        <Card title="Día que estás editando">
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full rounded-2xl border border-white/80 px-4 py-3 bg-white text-base" />
        </Card>

        {activeTab === "progress" && (
          <div className="space-y-4 md:space-y-6">
            <section className="grid grid-cols-2 gap-3 md:gap-4">
              <StatCard title="Peso actual" value={currentWeight ? `${currentWeight}kg` : "--"} sub="último guardado" />
              <StatCard title="Peso perdido" value={`${lost.toFixed(1)}kg`} sub="desde el inicio" />
              <StatCard title="Faltan" value={remainingKg !== null ? `${remainingKg.toFixed(1)}kg` : "--"} sub="para 73kg" />
              <StatCard title="Día válido" value={successToday ? "Sí ✅" : "No"} sub="kcal + proteína" />
            </section>
            <Card title="Objetivo 73kg">
              <div className="h-4 bg-stone-100 rounded-full overflow-hidden mb-3"><div className="h-full bg-stone-950 rounded-full" style={{ width: `${progress}%` }} /></div>
              <div className="flex justify-between text-sm text-stone-500"><span>{startWeight ? `${startWeight}kg inicio` : "mete tu primer peso"}</span><span>{Math.round(progress)}%</span><span>73kg</span></div>
            </Card>
            <DietCalendar foodsByDate={foodsByDate} />
          </div>
        )}

        {activeTab === "diet" && (
          <div className="space-y-4 md:space-y-6">
            <p className="text-sm text-stone-500">Trackeando: {new Date(selectedDate + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</p>
            <section className="grid grid-cols-2 gap-3 md:gap-4">
              <MacroPie label="kcal" value={totals.kcal} goal={GOALS.kcal} color={COLORS.kcal} unit=" kcal" />
              <MacroPie label="proteína" value={totals.protein} goal={GOALS.protein} color={COLORS.protein} unit="g" />
              <MacroPie label="carbos" value={totals.carbs} goal={GOALS.carbs} color={COLORS.carbs} unit="g" />
              <MacroPie label="grasas" value={totals.fat} goal={GOALS.fat} color={COLORS.fat} unit="g" />
            </section>
            <Card title="Añadir comida online">
              <textarea value={foodInput} onChange={(e) => { setFoodInput(e.target.value); setFoodSearch(e.target.value.replace(/\d+(?:[.,]\d+)?\s*(kg|g|ml|l|uds|ud|huevos?)/gi, "").trim()); }} placeholder="Ej: 300g yogur griego Hacendado" className="w-full min-h-24 rounded-2xl border border-white/80 px-4 py-3 mb-3 resize-none bg-white text-base leading-snug" />
              <button onClick={runFoodSearch} className="w-full rounded-2xl bg-stone-950 text-white py-3 font-semibold flex items-center justify-center gap-2"><Search size={18}/> Buscar macros online</button>
              {foodLoading && <p className="text-sm text-stone-500 mt-3">Buscando...</p>}
              {foodError && <p className="text-sm text-red-600 mt-3">{foodError}</p>}
              <div className="space-y-2 mt-4">{foodResults.map((item, i) => <FoodResult key={i} item={item} onAdd={() => addOnlineFood(item)} />)}</div>
            </Card>
            <Card title="Comidas de hoy">
              {foods.length === 0 ? <p className="text-sm text-stone-500">Todavía no has añadido comidas para este día.</p> : <div className="space-y-2">{foods.map((food) => <FoodRow key={food.id} food={food} onRemove={() => setFoodsForSelected((prev) => prev.filter((x) => x.id !== food.id))} />)}</div>}
            </Card>
            <Card title="Recomendaciones del día">
              <div className="space-y-2">{recommendations.map((food) => <Recommendation key={food.name} food={food} onAdd={() => quickAdd(food)} />)}</div>
            </Card>
          </div>
        )}

        {activeTab === "training" && (
          <div className="space-y-4 md:space-y-6">
            <Card title="Gym de hoy"><p className="text-sm text-stone-500 mb-3">Hoy toca: {trainingTypeForDate(new Date(selectedDate + "T12:00:00"))}</p><button onClick={toggleGym} className={`w-full rounded-2xl py-3 font-semibold ${selectedTraining.gymDone ? "bg-green-600 text-white" : "bg-stone-950 text-white"}`}>{selectedTraining.gymDone ? "Entreno marcado ✅" : "He entrenado lo que tocaba"}</button></Card>
            <Card title="Pasos"><div className="flex items-center gap-3 mb-3"><Footprints/><p className="font-semibold">{selectedTraining.steps || 0} / 10000 pasos</p></div><div className="h-4 bg-stone-100 rounded-full overflow-hidden mb-4"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((selectedTraining.steps || 0) / 10000) * 100)}%` }} /></div><input value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="10000" className="w-full rounded-2xl border border-white/80 px-4 py-3 mb-3 bg-white text-base"/><button onClick={saveSteps} className={`w-full rounded-2xl py-3 font-semibold ${selectedTraining.steps >= 10000 ? "bg-emerald-500 text-white" : "bg-stone-950 text-white"}`}>{selectedTraining.steps >= 10000 ? "Pasos cumplidos ✅" : "Guardar pasos"}</button></Card>
            <TrainingCalendar trainingLogs={trainingLogs}/>
            <StepsChart trainingLogs={trainingLogs}/>
          </div>
        )}

        {activeTab === "physique" && (
          <div className="space-y-4 md:space-y-6">
            <section className="grid grid-cols-2 gap-3 md:gap-4"><StatCard title="Peso inicial" value={startWeight ? `${startWeight}kg` : "--"}/><StatCard title="Peso actual" value={currentWeight ? `${currentWeight}kg` : "--"}/><StatCard title="% graso" value={bodyfat}/><StatCard title="Faltan" value={remainingKg !== null ? `${remainingKg.toFixed(1)}kg` : "--"}/></section>
            <Card title="Peso del día"><input value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full rounded-2xl border border-white/80 px-4 py-3 mb-3 bg-white text-base" placeholder="78.4"/><button onClick={saveWeight} className="w-full rounded-2xl bg-stone-950 text-white py-3 font-semibold">Guardar peso</button></Card>
            <Card title="Mirror check"><div className="grid grid-cols-3 gap-2 md:gap-3"><label className="aspect-[3/4] rounded-2xl border border-dashed border-neutral-300 flex flex-col items-center justify-center text-stone-500 cursor-pointer"><Camera/><span className="text-xs mt-2">Añadir foto</span><input type="file" accept="image/*" onChange={(e) => savePhoto(e.target.files?.[0])} className="hidden"/></label>{photos.slice(0, 2).map((item) => <PhotoCard key={item.id} item={item}/>)}</div></Card>
            <WeightChart weights={weights}/>
          </div>
        )}

        {activeTab === "sleep" && (
          <div className="space-y-4 md:space-y-6">
            <section className="grid grid-cols-2 gap-3 md:gap-4"><StatCard title="Horas" value={selectedSleep.hours ? `${selectedSleep.hours}h` : "--"}/><StatCard title="Calidad" value={`${selectedSleepInfo.score}/100`} sub={selectedSleepInfo.label}/></section>
            <Card title="Sueño del día"><input value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="7.5" className="w-full rounded-2xl border border-white/80 px-4 py-3 mb-3 bg-white text-base"/><button onClick={saveSleep} className="w-full rounded-2xl bg-stone-950 text-white py-3 font-semibold">Guardar sueño</button><div className={`mt-4 rounded-2xl p-4 text-sm font-medium ${selectedSleepInfo.cls}`}>{selectedSleepInfo.msg}</div></Card>
            <SleepChart sleepLogs={sleepLogs}/>
            <SleepCalendar sleepLogs={sleepLogs}/>
          </div>
        )}

        {activeTab === "masturbation" && (
          <div className="space-y-4 md:space-y-6">
            <section className="grid grid-cols-2 gap-3 md:gap-4"><StatCard title="Esta semana" value={pajaWeek.done ? "Usada" : "Disponible"}/><StatCard title="Regla" value="1/semana" sub="solo sábado o domingo"/></section>
            <Card title="Registro"><div className={`rounded-2xl p-4 text-sm font-medium mb-4 ${pajaWeek.boxCls}`}>{pajaWeek.msg}</div><button onClick={togglePaja} className={`w-full rounded-2xl py-3 font-semibold ${masturbationLogs[selectedDate]?.done ? "bg-red-600 text-white" : "bg-stone-950 text-white"}`}>{masturbationLogs[selectedDate]?.done ? "Quitar registro" : "Registrar paja"}</button></Card>
            <PajaCalendar logs={masturbationLogs}/>
          </div>
        )}


        {activeTab === "screen" && (
          <div className="space-y-4 md:space-y-6">
            <section className="grid grid-cols-2 gap-3 md:gap-4">
              <StatCard
                title="Uso móvil"
                value={selectedScreen.hours ? `${selectedScreen.hours}h` : "--"}
                sub="objetivo: 2h30"
              />
              <StatCard
                title="Estado"
                value={`${selectedScreenInfo.score}/100`}
                sub={selectedScreenInfo.label}
              />
            </section>

            <Card title="Tiempo de uso">
              <input
                value={screenHours}
                onChange={(e) => setScreenHours(e.target.value)}
                placeholder="2.5"
                className="w-full rounded-2xl border border-white/80 px-4 py-3 mb-3 bg-white text-base"
              />
              <button
                onClick={saveScreenTime}
                className="w-full rounded-2xl bg-stone-950 text-white py-3 font-semibold"
              >
                Guardar uso del móvil
              </button>
              <div className={`mt-4 rounded-2xl p-4 text-sm font-medium ${selectedScreenInfo.cls}`}>
                {selectedScreenInfo.msg}
              </div>
            </Card>

            <ScreenChart screenLogs={screenLogs} />
            <ScreenCalendar screenLogs={screenLogs} />
          </div>
        )}

      </div>

     <nav className="fixed left-3 right-3 bottom-[calc(0.95rem+env(safe-area-inset-bottom))] z-50 rounded-[2rem] bg-white/78 backdrop-blur-2xl border border-white/85 px-2.5 py-2.5 shadow-[0_18px_55px_rgba(120,80,30,0.20)]">
  <div className="flex gap-2 overflow-x-auto max-w-md md:max-w-4xl mx-auto no-scrollbar">

    <Tab
      active={activeTab === "progress"}
      onClick={() => setActiveTab("progress")}
      icon={<CalendarDays size={18} />}
      label="Progreso"
    />

    <Tab
      active={activeTab === "diet"}
      onClick={() => setActiveTab("diet")}
      icon={<ClipboardList size={18} />}
      label="Dieta"
    />

    <Tab
      active={activeTab === "training"}
      onClick={() => setActiveTab("training")}
      icon={<Dumbbell size={18} />}
      label="Entreno"
    />

    <Tab
      active={activeTab === "physique"}
      onClick={() => setActiveTab("physique")}
      icon={<Scale size={18} />}
      label="Físico"
    />

    <Tab
      active={activeTab === "sleep"}
      onClick={() => setActiveTab("sleep")}
      icon={<Moon size={18} />}
      label="Sueño"
    />

    <Tab
      active={activeTab === "masturbation"}
      onClick={() => setActiveTab("masturbation")}
      icon={<Heart size={18} />}
      label="Paja"
    />

    <Tab
      active={activeTab === "screen"}
      onClick={() => setActiveTab("screen")}
      icon={<Smartphone size={18} />}
      label="Móvil"
    />

  </div>
</nav>
    </div>
  );
}

function Card({ title, children }) { return <section className="rounded-[1.75rem] md:rounded-[2rem] bg-white/78 backdrop-blur-2xl border border-white/85 p-4 md:p-5 shadow-[0_14px_42px_rgba(120,80,30,0.10)] overflow-hidden"><h2 className="text-xl md:text-2xl font-black mb-4 leading-tight tracking-[-0.025em] text-stone-950">{title}</h2>{children}</section>; }
function StatCard({ title, value, sub }) { return <div className="rounded-[1.75rem] md:rounded-[2rem] bg-white/80 backdrop-blur-2xl border border-white/85 p-4 md:p-5 shadow-[0_14px_42px_rgba(120,80,30,0.10)] min-w-0 active:scale-[0.985] transition"><p className="text-[10px] md:text-xs uppercase tracking-[0.16em] text-stone-500 mb-2 truncate">{title}</p><h3 className="text-2xl md:text-3xl font-black leading-none break-words text-stone-950">{value}</h3>{sub && <p className="text-[11px] md:text-xs text-stone-500 mt-1 leading-tight">{sub}</p>}</div>; }
function Tab({ active, onClick, icon, label }) { return <button onClick={onClick} className={`shrink-0 w-[4.95rem] md:w-24 rounded-[1.35rem] py-3 md:py-3.5 flex flex-col items-center justify-center gap-1.5 text-[10px] md:text-xs font-bold transition-all duration-200 active:scale-95 ${active ? "bg-gradient-to-br from-stone-950 to-stone-700 text-white shadow-xl shadow-stone-900/20" : "bg-white/70 text-stone-500 border border-white/70"}`}>{icon}<span className="leading-none whitespace-nowrap">{label}</span></button>; }
function FoodRow({ food, onRemove }) { return <div className="rounded-2xl bg-white/65 border border-white/80 p-3 flex items-center justify-between gap-3 min-w-0"><div><p className="font-semibold text-sm leading-tight break-words">{food.name}</p><p className="text-xs text-stone-500">{food.kcal} kcal · P {food.protein} · C {food.carbs} · G {food.fat}</p><p className="text-[10px] text-stone-400">{food.source || "online"}</p></div><button onClick={onRemove} className="rounded-full bg-white border border-white/80 p-2"><X size={14}/></button></div>; }
function FoodResult({ item, onAdd }) { return <div className="rounded-2xl bg-white/55 border border-white/75 p-3 flex justify-between gap-3"><div><p className="font-semibold text-sm leading-tight break-words">{item.name}</p><p className="text-xs text-stone-500">{item.brand || "Open Food Facts"} · por 100g</p><p className="text-xs text-stone-500">{Math.round(item.kcal100)} kcal · P {Math.round(item.protein100)} · C {Math.round(item.carbs100)} · G {Math.round(item.fat100)}</p></div><button onClick={onAdd} className="h-9 w-9 rounded-full bg-stone-950 text-white flex items-center justify-center"><Plus size={16}/></button></div>; }
function Recommendation({ food, onAdd }) { return <div className="rounded-2xl bg-white/55 border border-white/75 p-3 flex justify-between items-center"><div><p className="font-semibold">{food.name}</p><p className="text-xs text-stone-500">P {food.protein} · C {food.carbs} · G {food.fat}</p></div><div className="text-right flex items-center gap-3"><div><p className="font-bold text-sm">{food.amount}</p><p className="text-xs text-stone-500">{food.kcal} kcal</p></div><button onClick={onAdd} className="h-9 w-9 rounded-full bg-stone-950 text-white flex items-center justify-center"><Plus size={16}/></button></div></div>; }
function PhotoCard({ item }) { return <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-neutral-200 relative"><img src={item.photo} className="w-full h-full object-cover"/><div className="absolute bottom-0 left-0 right-0 bg-white/80 p-2 text-xs font-semibold">{item.date} · {item.weight || "--"}kg</div></div>; }
function MacroPie({ label, value, goal, color, unit }) { const pct = Math.round((value / goal) * 100); const data = [{ name: "comido", value: Math.min(value, goal) }, { name: "faltante", value: Math.max(goal - value, 0) }]; return <div className="rounded-[1.75rem] md:rounded-[2rem] bg-white/80 backdrop-blur-2xl border border-white/85 px-3 py-5 md:p-5 shadow-[0_14px_42px_rgba(120,80,30,0.10)] min-w-0"><div className="h-36 md:h-40 relative"><ResponsiveContainer width="100%" height="100%"><PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}><Pie data={data} innerRadius="54%" outerRadius="74%" dataKey="value" startAngle={90} endAngle={-270}><Cell fill={color}/><Cell fill="#e7e5e4"/></Pie></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center"><p className={`text-xl md:text-2xl font-black ${pct > 100 ? "text-rose-600" : "text-stone-950"}`}>{pct}%</p><p className="text-xs text-stone-500">{label}</p></div></div><p className="font-semibold text-center mt-1 text-sm md:text-base leading-tight text-stone-700">{Math.round(value)} / {goal}{unit}</p></div>; }
function CalendarGrid({ renderDay }) { const today = new Date(); const year = today.getFullYear(); const month = today.getMonth(); const firstDay = new Date(year, month, 1); const daysInMonth = new Date(year, month + 1, 0).getDate(); const startOffset = (firstDay.getDay() + 6) % 7; const cells = [...Array.from({ length: startOffset }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))]; return <div className="w-full overflow-hidden"><div className="grid grid-cols-7 gap-1.5 md:gap-2 mb-2">{["L","M","X","J","V","S","D"].map((d) => <div key={d} className="text-center text-xs font-bold text-stone-400">{d}</div>)}</div><div className="grid grid-cols-7 gap-1.5 md:gap-2">{cells.map((date, i) => !date ? <div key={i} className="aspect-square"/> : renderDay(date))}</div></div>; }
function DietCalendar({ foodsByDate }) { return <Card title="Calendario de cumplimiento"><CalendarGrid renderDay={(date) => { const key = isoForDate(date); const foods = foodsByDate[key] || []; const totals = foods.reduce((a, f) => ({ kcal: a.kcal + f.kcal, protein: a.protein + f.protein }), { kcal: 0, protein: 0 }); const success = totals.kcal >= GOALS.kcal * 0.9 && totals.kcal <= GOALS.kcal * 1.1 && totals.protein >= GOALS.protein * 0.9; const cheat = totals.kcal > GOALS.kcal * 1.1 && totals.kcal <= GOALS.kcal * 1.5; const hasLog = foods.length > 0; let cls = "bg-stone-50 border-white/80 text-stone-500"; let label = ""; if (success) { cls = "bg-green-50 border-green-200 text-green-700"; label = "✓"; } else if (cheat) { cls = "bg-yellow-100 border-yellow-300 text-yellow-900"; label = "★"; } else if (hasLog) { cls = "bg-red-50 border-red-200 text-red-700"; label = "✕"; } return <div key={key} className={`aspect-square rounded-xl md:rounded-2xl border flex flex-col items-center justify-center text-[10px] md:text-xs font-bold leading-tight ${cls}`}><span>{date.getDate()}</span><span>{label}</span></div>; }}/></Card>; }
function TrainingCalendar({ trainingLogs }) { return <Card title="Calendario training"><CalendarGrid renderDay={(date) => { const key = isoForDate(date); const log = trainingLogs[key] || { gymDone: false, steps: 0 }; const plan = trainingTypeForDate(date); const isGymDay = plan !== "Rest"; const gym = log.gymDone; const steps = Number(log.steps || 0) >= 10000; let cls = "bg-stone-50 border-white/80 text-stone-500"; let label = plan; if (gym && steps && isGymDay) { cls = "bg-blue-100 border-blue-300 text-blue-900"; label = "Full"; } else if (gym && isGymDay) { cls = "bg-purple-100 border-purple-300 text-purple-900"; label = "Gym"; } else if (steps) { cls = "bg-emerald-100 border-emerald-300 text-emerald-900"; label = "Pasos"; } else if (isGymDay) { cls = "bg-red-50 border-red-200 text-red-700"; label = "Nada"; } return <div key={key} className={`aspect-square rounded-xl md:rounded-2xl border flex flex-col items-center justify-center text-[10px] md:text-xs font-bold leading-tight ${cls}`}><span>{date.getDate()}</span><span>{label}</span></div>; }}/></Card>; }
function StepsChart({ trainingLogs }) { const data = Object.entries(trainingLogs).sort(([a],[b]) => a.localeCompare(b)).slice(-10).map(([date, log]) => ({ date: date.slice(5), steps: Number(log.steps || 0) })); return <Card title="Historial de pasos"><Chart data={data} x="date" y="steps" color="#10b981" domain={[0, 15000]}/></Card>; }
function WeightChart({ weights }) { const data = [...weights].reverse().slice(-10).map((w) => ({ date: w.date.slice(5), weight: Number(w.weight) })); return <Card title="Historial de peso"><Chart data={data} x="date" y="weight" color="#4f46e5" domain={["auto", "auto"]}/></Card>; }
function SleepChart({ sleepLogs }) { const data = Object.entries(sleepLogs).sort(([a],[b]) => a.localeCompare(b)).slice(-10).map(([date, log]) => ({ date: date.slice(5), hours: Number(log.hours || 0) })); return <Card title="Historial de sueño"><Chart data={data} x="date" y="hours" color="#6366f1" domain={[0, 10]}/></Card>; }
function Chart({ data, x, y, color, domain }) { return <div className="h-56 md:h-64 -mx-2 pt-4 pb-2"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 18, right: 18, bottom: 12, left: -10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4"/><XAxis dataKey={x} tick={{ fontSize: 11, fill: "#78716c" }}/><YAxis domain={domain} tick={{ fontSize: 11, fill: "#78716c" }}/><Tooltip contentStyle={{ borderRadius: 16, border: "1px solid #e7e5e4", boxShadow: "0 12px 30px rgba(120,80,30,0.12)" }}/><Line type="monotone" dataKey={y} stroke={color} strokeWidth={3.5} dot={{ r: 4 }} activeDot={{ r: 6 }}/></LineChart></ResponsiveContainer></div>; }
function SleepCalendar({ sleepLogs }) { return <Card title="Calendario sueño"><CalendarGrid renderDay={(date) => { const key = isoForDate(date); const h = Number(sleepLogs[key]?.hours || 0); const info = sleepInfo(h); const cls = h ? info.cls.replace("text-", "border-").replace("bg-", "bg-") : "bg-stone-50 border-white/80 text-stone-500"; return <div key={key} className={`aspect-square rounded-xl md:rounded-2xl border flex flex-col items-center justify-center text-[10px] md:text-xs font-bold leading-tight ${cls}`}><span>{date.getDate()}</span><span>{h ? `${h}h` : ""}</span></div>; }}/></Card>; }
function getPajaWeek(date, logs) { const wk = weekKeyFromDate(date); const entries = Object.entries(logs).filter(([d, v]) => v.done && weekKeyFromDate(d) === wk); const done = entries.length > 0; const selectedDone = logs[date]?.done; const badWeekday = entries.some(([d]) => !isWeekend(d)); let msg = "Disponible: úsala solo sábado o domingo."; let boxCls = "bg-green-50 text-green-700"; if (badWeekday) { msg = "Usada entre semana: este finde queda bloqueado."; boxCls = "bg-red-50 text-red-700"; } else if (done && !selectedDone) { msg = "Ya has usado la de esta semana."; boxCls = "bg-yellow-50 text-yellow-800"; } else if (selectedDone) { msg = isWeekend(date) ? "Uso válido de la semana." : "Uso fuera de finde: bloquea este finde."; boxCls = isWeekend(date) ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"; } return { done, msg, boxCls }; }
function PajaCalendar({ logs }) { return <Card title="Calendario paja"><CalendarGrid renderDay={(date) => { const key = isoForDate(date); const done = logs[key]?.done; const weekend = isWeekend(key); let cls = weekend ? "bg-green-50 border-green-200 text-green-700" : "bg-stone-50 border-white/80 text-stone-500"; let label = weekend ? "OK" : "No"; if (done && weekend) { cls = "bg-blue-100 border-blue-300 text-blue-900"; label = "✓"; } if (done && !weekend) { cls = "bg-red-50 border-red-200 text-red-700"; label = "Bloq"; } return <div key={key} className={`aspect-square rounded-xl md:rounded-2xl border flex flex-col items-center justify-center text-[10px] md:text-xs font-bold leading-tight ${cls}`}><span>{date.getDate()}</span><span>{label}</span></div>; }}/></Card>; }
function ScreenChart({ screenLogs }) {
  const data = Object.entries(screenLogs)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([date, log]) => ({
      date: date.slice(5),
      hours: Number(log.hours || 0),
    }));

  return (
    <Card title="Historial uso móvil">
      <Chart data={data} x="date" y="hours" color="#0ea5e9" domain={[0, 8]} />
    </Card>
  );
}

function ScreenCalendar({ screenLogs }) {
  return (
    <Card title="Calendario móvil">
      <CalendarGrid
        renderDay={(date) => {
          const key = isoForDate(date);
          const h = Number(screenLogs[key]?.hours || 0);
          const info = screenInfo(h);
          const cls = h ? info.cls : "bg-stone-50 border-white/80 text-stone-500";

          return (
            <div
              key={key}
              className={`aspect-square rounded-xl md:rounded-2xl border flex flex-col items-center justify-center text-[10px] md:text-xs font-bold leading-tight ${cls}`}
            >
              <span>{date.getDate()}</span>
              <span>{h ? `${h}h` : ""}</span>
            </div>
          );
        }}
      />
    </Card>
  );
}