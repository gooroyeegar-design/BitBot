import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { Mic, X, Home as HomeIcon, UtensilsCrossed, Gamepad2, Droplets, BedDouble } from "lucide-react";

const CLAMP = (n) => Math.max(0, Math.min(100, n));

const FOOD_ITEMS = [
  { id: "battery", emoji: "🔋", name: "Battery", type: "favorite" },
  { id: "oil", emoji: "🛢️", name: "Oil Can", type: "neutral" },
  { id: "gear", emoji: "⚙️", name: "Gear Donut", type: "neutral" },
  { id: "pizza", emoji: "🍕", name: "Pizza", type: "neutral" },
  { id: "broccoli", emoji: "🥦", name: "Broccoli", type: "dislike" },
];

const TALK_LINES = {
  sleepy: ["*yawn* ...five more minutes?", "Zzz... oh! Hi there...", "So... sleepy..."],
  hungry: ["My tummy's making beeping noises...", "Got any snacks on you?", "I could really go for a battery right now."],
  uncomfortable: ["I feel kinda grimy...", "Bath time soon, maybe?", "A little dusty over here."],
  sad: ["I'm feeling a little blue...", "Could use some company...", "Meh. Just an off day."],
  excited: ["This is the BEST day ever!!", "Let's go go go!!", "I feel AMAZING right now!"],
  content: ["Beep boop! I'm okay!", "Just vibing over here.", "What's up?", "Systems nominal! Also, hi."],
};

const NAV = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "food", label: "Food", icon: UtensilsCrossed },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "clean", label: "Clean", icon: Droplets },
  { id: "sleep", label: "Sleep", icon: BedDouble },
];

export default function BitBotApp() {
  const [stats, setStats] = useState(() => {
    try {
      const saved = localStorage.getItem("bitbot-stats");
      return saved ? { hunger: 62, energy: 70, happiness: 68, hygiene: 58, ...JSON.parse(saved) } : { hunger: 62, energy: 70, happiness: 68, hygiene: 58 };
    } catch {
      return { hunger: 62, energy: 70, happiness: 68, hygiene: 58 };
    }
  });
  const [screen, setScreen] = useState("home");
  const [sleeping, setSleeping] = useState(false);
  const [sleepStage, setSleepStage] = useState("idle"); // idle -> walking -> yawning -> inbed -> sleeping -> waking
  const [transient, setTransient] = useState(null); // overrides mood briefly
  const [speech, setSpeech] = useState(null);
  const [blink, setBlink] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [chewing, setChewing] = useState(false);
  const [flyingFood, setFlyingFood] = useState(null);
  const [dirtSpots, setDirtSpots] = useState([]);
  const [spongePos, setSpongePos] = useState(null);
  const [curious, setCurious] = useState(false);

  const speechTimer = useRef(null);
  const transientTimer = useRef(null);
  const tapLog = useRef([]);
  const pressTimer = useRef(null);
  const talkTimers = useRef([]);
  const roomRef = useRef(null);
  const botRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  // ---- persistent pet state ----
  useEffect(() => {
    try { localStorage.setItem("bitbot-stats", JSON.stringify(stats)); } catch {}
  }, [stats]);

  useEffect(() => {
    return () => {
      try { speechRecognitionRef.current?.removeAllListeners?.(); } catch {}
    };
  }, []);

  // ---- decay loop ----
  useEffect(() => {
    const t = setInterval(() => {
      setStats((s) => {
        if (sleeping) {
          return { ...s, energy: CLAMP(s.energy + 7), hunger: CLAMP(s.hunger - 0.6), hygiene: CLAMP(s.hygiene - 0.3) };
        }
        if (screen === "food" || screen === "clean" || screen.startsWith("game")) return s;
        return {
          hunger: CLAMP(s.hunger - 1.6),
          energy: CLAMP(s.energy - 1),
          happiness: CLAMP(s.happiness - 1.3),
          hygiene: CLAMP(s.hygiene - 0.8),
        };
      });
    }, 4000);
    return () => clearInterval(t);
  }, [sleeping, screen]);

  // ---- blink loop ----
  useEffect(() => {
    const t = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 150);
    }, 3000 + Math.random() * 1500);
    return () => clearInterval(t);
  }, []);

  // ---- idle curious look-around ----
  useEffect(() => {
    if (screen !== "home" || sleeping) return;
    const t = setInterval(() => {
      if (!transient) {
        setCurious(true);
        setTimeout(() => setCurious(false), 1400);
      }
    }, 9000 + Math.random() * 4000);
    return () => clearInterval(t);
  }, [screen, sleeping, transient]);

  useEffect(() => () => {
    clearTimeout(speechTimer.current);
    clearTimeout(transientTimer.current);
    clearTimeout(pressTimer.current);
    talkTimers.current.forEach(clearTimeout);
  }, []);

  const baseMood = useMemo(() => {
    if (sleeping) return "sleepy";
    if (stats.energy < 22) return "sleepy";
    if (stats.hunger < 22) return "hungry";
    if (stats.hygiene < 22) return "uncomfortable";
    if (stats.happiness < 25) return "sad";
    if (stats.happiness > 80) return "excited";
    return "content";
  }, [stats, sleeping]);

  const displayMood = transient || baseMood;

  const say = (text, ms = 1800) => {
    setSpeech(text);
    clearTimeout(speechTimer.current);
    speechTimer.current = setTimeout(() => setSpeech(null), ms);
  };

  const react = (reactionMood, text, ms = 1000) => {
    setTransient(reactionMood);
    if (text) say(text, Math.max(ms, 1400));
    clearTimeout(transientTimer.current);
    transientTimer.current = setTimeout(() => setTransient(null), ms);
  };

  // ---- tap handling ----
  const registerTap = () => {
    const now = Date.now();
    tapLog.current = [...tapLog.current, now].filter((t) => now - t < 2500);
    return tapLog.current.length;
  };

  const tapHead = () => {
    const count = registerTap();
    if (count >= 6) {
      react("annoyed", "Okay okay!! Too much poking! 😤", 1100);
      tapLog.current = [];
      return;
    }
    setStats((s) => ({ ...s, happiness: CLAMP(s.happiness + 3) }));
    const lines = ["Hehe!", "That tickles!", "Beep!", ":)", "Hi hi!"];
    react(baseMood === "sad" ? "content" : "playful", lines[Math.floor(Math.random() * lines.length)], 900);
  };

  const tapBelly = () => {
    registerTap();
    setStats((s) => ({ ...s, happiness: CLAMP(s.happiness + 2) }));
    react("surprised", ["Bwahaha!", "Hey, that's my core!", "Boop!"][Math.floor(Math.random() * 3)], 900);
  };

  const tapAntenna = () => {
    registerTap();
    react("surprised", "Wh-what was that?!", 800);
  };

  const startPress = () => {
    pressTimer.current = setTimeout(() => {
      react("curious-long", "Mmm... what are you thinking about?", 1600);
    }, 650);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  // ---- talking feature ----
  const answerUser = (spokenText = "") => {
    const text = spokenText.toLowerCase();
    let line;
    let reactionMood = "playful";
    if (/hello|hi|hey/.test(text)) {
      line = ["Hiii! 🤖", "Beep boop! You came back!", "Hey! I was waiting for you!"][Math.floor(Math.random() * 3)];
      reactionMood = "excited";
    } else if (/love|cute|good|great|happy/.test(text)) {
      line = ["Awww! You're making my circuits blush!", "Hehe, I like you too!", "Best human ever! 💚"][Math.floor(Math.random() * 3)];
      reactionMood = "excited";
    } else if (/hungry|food|eat|battery/.test(text)) {
      line = "Did someone say BATTERY?! 🔋";
      reactionMood = "hungry-ask";
    } else if (/sleep|tired|bed/.test(text)) {
      line = "Mmm... bed sounds pretty good right now... 😴";
      reactionMood = "sleepy";
    } else if (/sad|bad|upset/.test(text)) {
      line = "Come here. Tiny robot hug incoming. 🤗";
      reactionMood = "content";
    } else {
      const lines = TALK_LINES[baseMood] || TALK_LINES.content;
      line = lines[Math.floor(Math.random() * lines.length)];
      const reactionMap = { excited: "excited", hungry: "hungry-ask", sleepy: "sleepy", sad: "sad", uncomfortable: "uncomfortable", content: "playful" };
      reactionMood = reactionMap[baseMood] || "playful";
    }
    react(reactionMood, line, 2400);
    try {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(line.replace(/[🤖💚🔋😴🤗]/g, ""));
        utterance.rate = 1.05;
        utterance.pitch = 1.25;
        window.speechSynthesis.speak(utterance);
      }
    } catch {}
  };

  const startTalking = async () => {
    if (listening || thinking || sleeping) return;
    setListening(true);
    say("I'm listening...", 4000);

    try {
      if (Capacitor.isNativePlatform()) {
        const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
        speechRecognitionRef.current = SpeechRecognition;
        const permission = await SpeechRecognition.requestPermissions();
        if (permission?.speechRecognition === "denied") throw new Error("Microphone permission denied");
        const language = (navigator.language || "en-US").toLowerCase().startsWith("ar") ? "ar-DZ" : "en-US";
        const result = await SpeechRecognition.start({ language, maxResults: 1, prompt: "Talk to BitBot", partialResults: false, popup: false });
        setListening(false);
        setThinking(true);
        setTimeout(() => {
          setThinking(false);
          answerUser(result?.matches?.[0] || "");
        }, 500);
      } else if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
        const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new Recognition();
        recognition.lang = (navigator.language || "en-US").startsWith("ar") ? "ar-DZ" : "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript || "";
          setListening(false);
          setThinking(true);
          setTimeout(() => { setThinking(false); answerUser(transcript); }, 500);
        };
        recognition.onerror = () => {
          setListening(false);
          setThinking(false);
          answerUser("");
        };
        recognition.onend = () => setListening(false);
        recognition.start();
      } else {
        setTimeout(() => { setListening(false); setThinking(true); }, 1200);
        setTimeout(() => { setThinking(false); answerUser(""); }, 1700);
      }
    } catch (error) {
      console.warn("Speech recognition unavailable:", error);
      setListening(false);
      setThinking(true);
      setTimeout(() => { setThinking(false); answerUser(""); }, 700);
    }
  };

  // ---- feeding ----
  const feedFood = (food) => {
    if (flyingFood) return;
    const room = roomRef.current;
    const bot = botRef.current;
    if (!room || !bot) return;
    const roomRect = room.getBoundingClientRect();
    const botRect = bot.getBoundingClientRect();
    const trayEl = document.getElementById(`food-${food.id}`);
    const trayRect = trayEl ? trayEl.getBoundingClientRect() : roomRect;
    setFlyingFood({
      ...food,
      startX: trayRect.left - roomRect.left + trayRect.width / 2,
      startY: trayRect.top - roomRect.top + trayRect.height / 2,
      endX: botRect.left - roomRect.left + botRect.width / 2,
      endY: botRect.top - roomRect.top + botRect.height * 0.45,
      landed: false,
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlyingFood((f) => (f ? { ...f, landed: true } : f));
      });
    });
  };

  const onFoodArrive = () => {
    if (!flyingFood) return;
    const food = flyingFood;
    setFlyingFood(null);
    setChewing(true);
    setTimeout(() => setChewing(false), 700);
    if (food.type === "favorite") {
      setStats((s) => ({ ...s, hunger: CLAMP(s.hunger + 32), happiness: CLAMP(s.happiness + 18) }));
      react("excited", `MY FAVORITE! ${food.emoji}`, 1600);
    } else if (food.type === "dislike") {
      setStats((s) => ({ ...s, hunger: CLAMP(s.hunger + 6), happiness: CLAMP(s.happiness - 4) }));
      react("disgust", "Ew... no thank you.", 1400);
    } else {
      setStats((s) => ({ ...s, hunger: CLAMP(s.hunger + 18), happiness: CLAMP(s.happiness + 6) }));
      react("content", "Yum, thanks!", 1200);
    }
  };

  // ---- cleaning ----
  const enterClean = () => {
    const count = 3 + Math.round((100 - stats.hygiene) / 25);
    const spots = Array.from({ length: Math.min(6, Math.max(3, count)) }, (_, i) => ({
      id: i,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 55,
      cleaned: false,
    }));
    setDirtSpots(spots);
    setScreen("clean");
  };

  const onSpongeMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setSpongePos({ x, y });
    setDirtSpots((spots) =>
      spots.map((sp) => {
        if (sp.cleaned) return sp;
        const dist = Math.hypot(sp.x - x, sp.y - y);
        if (dist < 11) {
          setStats((s) => ({ ...s, hygiene: CLAMP(s.hygiene + 10) }));
          return { ...sp, cleaned: true };
        }
        return sp;
      })
    );
  };

  const allClean = dirtSpots.length > 0 && dirtSpots.every((s) => s.cleaned);

  useEffect(() => {
    if (allClean) {
      setStats((s) => ({ ...s, hygiene: 100 }));
      react("excited", "Squeaky clean! ✨", 1400);
    }
  }, [allClean]);

  // ---- sleep sequence ----
  const enterSleep = () => {
    setScreen("sleep");
    setSleepStage("walking");
    const t1 = setTimeout(() => setSleepStage("yawning"), 1400);
    const t2 = setTimeout(() => setSleepStage("inbed"), 2600);
    const t3 = setTimeout(() => {
      setSleepStage("sleeping");
      setSleeping(true);
    }, 3400);
    talkTimers.current.push(t1, t2, t3);
  };

  useEffect(() => {
    if (sleeping && stats.energy >= 100) {
      setSleepStage("waking");
      setSleeping(false);
      setTimeout(() => {
        setScreen("home");
        setSleepStage("idle");
        react("excited", "All charged up!", 1400);
      }, 900);
    }
  }, [stats.energy, sleeping]);

  const wakeNow = () => {
    setSleeping(false);
    setSleepStage("waking");
    setTimeout(() => {
      setScreen("home");
      setSleepStage("idle");
    }, 800);
  };

  const goHome = () => setScreen("home");

  return (
    <div className="w-full h-screen max-h-screen bg-[#1c1e2b] flex items-center justify-center overflow-hidden font-sans">
      <style>{`
        @keyframes idleBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes breathSlow { 0%,100% { transform: translateY(0) scale(1) } 50% { transform: translateY(-3px) scale(1.01) } }
        @keyframes antennaSway { 0%,100% { transform: rotate(-7deg) } 50% { transform: rotate(7deg) } }
        @keyframes antennaPerk { 0%,100% { transform: rotate(0deg) scaleY(1) } 50% { transform: rotate(0deg) scaleY(1.15) } }
        @keyframes pokeSquish { 0% { transform: scale(1,1) } 40% { transform: scale(1.14,0.84) } 100% { transform: scale(1,1) } }
        @keyframes bellyPop { 0% { transform: scale(1) } 30% { transform: scale(0.85,1.15) } 60%{transform:scale(1.08,0.92)} 100% { transform: scale(1) } }
        @keyframes danceBounce { 0%,100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-16px) rotate(4deg) } }
        @keyframes shakeNo { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-6px) } 75% { transform: translateX(6px) } }
        @keyframes surprisedPop { 0% { transform: scale(1) } 40% { transform: scale(1.18) } 100% { transform: scale(1) } }
        @keyframes chewBite { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(0.55) } }
        @keyframes zzzFloat { 0% { opacity:0; transform: translate(0,0) scale(0.6);} 30%{opacity:1;} 100% { opacity:0; transform: translate(16px,-30px) scale(1.15);} }
        @keyframes floatUp { 0% { opacity:0; transform: translateY(0) scale(0.6);} 20% {opacity:1; transform: translateY(-8px) scale(1);} 100% { opacity:0; transform: translateY(-46px) scale(1);} }
        @keyframes ringPulse { 0% { transform: scale(0.9); opacity:0.7 } 100% { transform: scale(1.5); opacity:0 } }
        @keyframes tiltLook { 0%,100% { transform: rotate(0deg) } 30% { transform: rotate(-9deg) } 70% { transform: rotate(9deg) } }
        @keyframes fallDown { from { transform: translateY(-20px);} to { transform: translateY(340px);} }
        @keyframes sparkleWiggle { 0%,100% { transform: scale(1) rotate(0deg);} 50% { transform: scale(1.3) rotate(15deg);} }
        .anim-bob { animation: idleBob 2.4s ease-in-out infinite; }
        .anim-breath { animation: breathSlow 3.6s ease-in-out infinite; }
        .anim-sway { animation: antennaSway 2.6s ease-in-out infinite; transform-origin: bottom center; }
        .anim-perk { animation: antennaPerk 0.6s ease-in-out infinite; transform-origin: bottom center; }
        .anim-poke { animation: pokeSquish 0.35s ease; }
        .anim-belly { animation: bellyPop 0.5s ease; }
        .anim-dance { animation: danceBounce 0.55s ease-in-out infinite; }
        .anim-shake { animation: shakeNo 0.4s ease-in-out; }
        .anim-surprise { animation: surprisedPop 0.4s ease; }
        .anim-chew { animation: chewBite 0.35s ease-in-out infinite; }
        .anim-zzz { animation: zzzFloat 2.2s ease-in-out infinite; }
        .anim-float { animation: floatUp 1s ease-out forwards; }
        .anim-ring { animation: ringPulse 1.2s ease-out infinite; }
        .anim-tilt { animation: tiltLook 1.4s ease-in-out; }
        .anim-sparkle { animation: sparkleWiggle 0.6s ease-in-out infinite; }
      `}</style>

      {/* phone frame */}
      <div className="relative w-full h-full max-w-md mx-auto overflow-hidden">
        {screen === "home" && (
          <HomeScreen
            roomRef={roomRef}
            botRef={botRef}
            mood={displayMood}
            blink={blink}
            curious={curious}
            speech={speech}
            listening={listening}
            thinking={thinking}
            onTapHead={tapHead}
            onTapBelly={tapBelly}
            onTapAntenna={tapAntenna}
            onPressStart={startPress}
            onPressEnd={cancelPress}
            onMic={startTalking}
            stats={stats}
          />
        )}

        {screen === "food" && (
          <FoodScreen
            roomRef={roomRef}
            botRef={botRef}
            mood={displayMood}
            blink={blink}
            speech={speech}
            chewing={chewing}
            flyingFood={flyingFood}
            onFoodArrive={onFoodArrive}
            onPick={feedFood}
            onBack={goHome}
          />
        )}

        {screen === "clean" && (
          <CleanScreen
            botRef={botRef}
            mood={displayMood}
            blink={blink}
            dirtSpots={dirtSpots}
            spongePos={spongePos}
            onMove={onSpongeMove}
            allClean={allClean}
            onBack={goHome}
          />
        )}

        {screen === "sleep" && (
          <SleepScreen mood={displayMood} stage={sleepStage} energy={stats.energy} onWake={wakeNow} onBack={sleepStage === "idle" ? goHome : null} />
        )}

        {screen === "games" && <GamesMenu onPick={(g) => setScreen(g)} onBack={goHome} />}

        {screen === "game-spark" && (
          <MiniGame
            title="Spark Catch"
            instructions="Tap the sparks before they vanish!"
            variant="spark"
            onEarn={(n) => setStats((s) => ({ ...s, happiness: CLAMP(s.happiness + Math.min(30, n * 4)), energy: CLAMP(s.energy - 8) }))}
            onDone={() => setScreen("home")}
          />
        )}

        {screen === "game-catch" && (
          <MiniGame
            title="Battery Drop"
            instructions="Catch the falling batteries!"
            variant="catch"
            onEarn={(n) => setStats((s) => ({ ...s, happiness: CLAMP(s.happiness + Math.min(30, n * 3)), energy: CLAMP(s.energy - 8) }))}
            onDone={() => setScreen("home")}
          />
        )}

        {/* bottom nav */}
        {["home", "food", "clean", "games"].includes(screen) && (
          <div className="absolute bottom-0 left-0 right-0 h-[72px] bg-[#14151f]/95 backdrop-blur flex items-center justify-around px-2 z-30">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = screen === n.id || (n.id === "games" && screen.startsWith("game"));
              return (
                <button
                  key={n.id}
                  onClick={() => (n.id === "clean" ? enterClean() : n.id === "sleep" ? enterSleep() : setScreen(n.id))}
                  className="flex flex-col items-center gap-1 px-2 py-1 active:scale-90 transition-transform"
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${active ? "bg-[#6ee7c9]" : "bg-white/10"}`}>
                    <Icon size={18} className={active ? "text-[#0d3b32]" : "text-white/70"} />
                  </div>
                  <span className={`text-[10px] font-semibold ${active ? "text-[#6ee7c9]" : "text-white/50"}`}>{n.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Face ---------------- */

function faceParams(mood) {
  switch (mood) {
    case "excited":
      return { eye: "big", mouth: "grin", cheeks: true, antenna: "perk", bodyAnim: "anim-dance", bob: "anim-bob", coreColor: "#5be08a" };
    case "playful":
      return { eye: "wink", mouth: "grin", cheeks: true, antenna: "sway", bodyAnim: "", bob: "anim-bob", coreColor: "#6ee7c9" };
    case "hungry":
    case "hungry-ask":
      return { eye: "droopy", mouth: "o", cheeks: false, antenna: "sway", bodyAnim: "", bob: "anim-bob", coreColor: "#f4a24b" };
    case "sleepy":
      return { eye: "closed", mouth: "yawn", cheeks: false, antenna: "droop", bodyAnim: "", bob: "anim-breath", coreColor: "#5b9df4" };
    case "sad":
      return { eye: "droopy", mouth: "frown", cheeks: false, antenna: "droop", bodyAnim: "", bob: "anim-breath", coreColor: "#8b93a7" };
    case "uncomfortable":
      return { eye: "squint", mouth: "frown", cheeks: false, antenna: "droop", bodyAnim: "", bob: "anim-bob", coreColor: "#8fae5c" };
    case "surprised":
      return { eye: "wide", mouth: "o-big", cheeks: false, antenna: "perk", bodyAnim: "anim-surprise", bob: "", coreColor: "#f7c94b" };
    case "annoyed":
      return { eye: "angry", mouth: "flat", cheeks: false, antenna: "sway", bodyAnim: "anim-shake", bob: "", coreColor: "#f4665a" };
    case "disgust":
      return { eye: "squint", mouth: "wavy", cheeks: false, antenna: "droop", bodyAnim: "anim-shake", bob: "", coreColor: "#8fae5c" };
    case "curious-long":
      return { eye: "round", mouth: "small", cheeks: false, antenna: "perk", bodyAnim: "", bob: "anim-tilt", coreColor: "#6ee7c9" };
    default:
      return { eye: "round", mouth: "smile", cheeks: false, antenna: "sway", bodyAnim: "", bob: "anim-bob", coreColor: "#6ee7c9" };
  }
}

function Eye({ shape, blink, side }) {
  if (blink && shape !== "closed") shape = "closed";
  const base = "absolute w-4 h-4 rounded-full bg-slate-700";
  const pos = side === "l" ? "left-7" : "right-7";
  if (shape === "closed") return <div className={`absolute ${pos} top-9 w-4 h-0.5 bg-slate-600 rounded-full`} />;
  if (shape === "droopy") return <div className={`${base} ${pos} top-10`} />;
  if (shape === "squint") return <div className={`absolute ${pos} top-9 w-4 h-1.5 bg-slate-600 rounded-full`} />;
  if (shape === "wide" || shape === "big") return <div className={`${base} ${pos} top-8 w-5 h-5`} />;
  if (shape === "angry")
    return (
      <div
        className={`absolute ${pos} top-8 w-4 h-1.5 bg-slate-700 rounded-full`}
        style={{ transform: side === "l" ? "rotate(18deg)" : "rotate(-18deg)" }}
      />
    );
  if (shape === "wink" && side === "l") return <div className={`absolute ${pos} top-9 w-4 h-0.5 bg-slate-600 rounded-full`} />;
  return <div className={`${base} ${pos} top-8`} />;
}

function Mouth({ shape }) {
  if (shape === "smile") return <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-6 h-3 border-b-2 border-slate-600 rounded-b-full" />;
  if (shape === "small") return <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3 h-1.5 border-b-2 border-slate-600 rounded-b-full" />;
  if (shape === "grin") return <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 w-8 h-4 bg-slate-700 rounded-b-full" />;
  if (shape === "o") return <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3 h-3 border-2 border-slate-600 rounded-full" />;
  if (shape === "o-big") return <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 border-2 border-slate-600 rounded-full" />;
  if (shape === "yawn") return <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-3 bg-slate-600 rounded-full" />;
  if (shape === "frown") return <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-6 h-3 border-t-2 border-slate-600 rounded-t-full" />;
  if (shape === "flat") return <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-slate-600 rounded-full" />;
  if (shape === "wavy") return <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-6 h-2 border-b-2 border-slate-600 rounded-b-full opacity-80" style={{ borderStyle: "dashed" }} />;
  return <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-5 h-2 border-b-2 border-slate-600 rounded-b-full" />;
}

const BitBotCharacter = React.forwardRef(function BitBotCharacter(
  { mood, blink, scale = 1, onTapHead, onTapBelly, onTapAntenna, onPressStart, onPressEnd, chewing, listening, dirty, poke },
  ref
) {
  const f = faceParams(mood);
  return (
    <div
      ref={ref}
      className="relative select-none"
      style={{ transform: `scale(${scale})`, WebkitTapHighlightColor: "transparent" }}
      onPointerDown={onPressStart}
      onPointerUp={onPressEnd}
      onPointerLeave={onPressEnd}
    >
      <div className={`relative ${f.bob} ${poke ? "anim-poke" : ""}`}>
        {listening && (
          <div className="absolute -inset-6 rounded-full border-2 border-[#6ee7c9]/60 anim-ring" style={{ top: -10 }} />
        )}
        {mood === "sleepy" && (
          <div className="anim-zzz absolute -top-3 -right-4 text-xl font-bold text-slate-300 z-20">Z</div>
        )}

        {/* antenna */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTapAntenna && onTapAntenna();
          }}
          className={`absolute -top-7 left-1/2 -translate-x-1/2 w-2 h-8 origin-bottom ${
            f.antenna === "perk" ? "anim-perk" : f.antenna === "droop" ? "" : "anim-sway"
          }`}
          style={{ transform: f.antenna === "droop" ? "rotate(35deg)" : undefined }}
        >
          <div className="w-2 h-8 bg-slate-400 rounded-full mx-auto" />
          <div className="absolute -top-2 -left-1.5 w-5 h-5 rounded-full" style={{ background: f.coreColor, boxShadow: `0 0 12px 3px ${f.coreColor}99` }} />
        </button>

        {/* head */}
        <button
          onClick={onTapHead}
          className={`w-32 h-28 rounded-[38px] bg-[#eef1f5] border-[3px] border-slate-200 relative flex items-center justify-center shadow-xl ${
            mood === "curious-long" ? "anim-tilt" : ""
          }`}
        >
          <Eye shape={f.eye} blink={blink} side="l" />
          <Eye shape={f.eye} blink={blink} side="r" />
          {f.cheeks && (
            <>
              <div className="absolute left-2.5 top-14 w-4 h-2.5 rounded-full bg-pink-300/70" />
              <div className="absolute right-2.5 top-14 w-4 h-2.5 rounded-full bg-pink-300/70" />
            </>
          )}
          {dirty && (
            <>
              <div className="absolute left-4 top-4 w-3 h-3 rounded-full bg-lime-700/40" />
              <div className="absolute right-6 top-5 w-2.5 h-2.5 rounded-full bg-lime-700/40" />
            </>
          )}
          <div className={chewing ? "anim-chew" : ""}>
            <Mouth shape={f.mouth} />
          </div>
        </button>

        {/* body */}
        <div className="w-24 h-20 mx-auto -mt-1 rounded-[26px] bg-[#dfe4ea] border-[3px] border-slate-200 relative flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTapBelly && onTapBelly();
            }}
            className="w-7 h-7 rounded-full shadow-inner active:scale-90 transition-transform"
            style={{ background: f.coreColor, boxShadow: `0 0 12px 3px ${f.coreColor}88` }}
          />
          <div className={`absolute -left-3.5 top-3 w-3.5 h-9 bg-[#dfe4ea] border-[3px] border-slate-200 rounded-full ${f.bodyAnim === "anim-dance" ? "anim-dance" : ""}`} />
          <div className="absolute -right-3.5 top-3 w-3.5 h-9 bg-[#dfe4ea] border-[3px] border-slate-200 rounded-full" />
        </div>
        <div className="flex justify-center gap-3 -mt-1">
          <div className="w-6 h-3.5 bg-[#c7ccd3] rounded-full" />
          <div className="w-6 h-3.5 bg-[#c7ccd3] rounded-full" />
        </div>
      </div>
    </div>
  );
});

function SpeechBubble({ text }) {
  if (!text) return null;
  return (
    <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-30 bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-2xl shadow-lg max-w-[220px] text-center">
      {text}
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-white rotate-45 -mt-1" />
    </div>
  );
}

/* ---------------- Home ---------------- */

function HomeScreen({ roomRef, botRef, mood, blink, curious, speech, listening, thinking, onTapHead, onTapBelly, onTapAntenna, onPressStart, onPressEnd, onMic, stats }) {
  return (
    <div ref={roomRef} className="relative w-full h-full bg-gradient-to-b from-[#3b3f6b] via-[#4d5389] to-[#6a6fae] overflow-hidden">
      {/* window */}
      <div className="absolute top-8 left-8 w-24 h-20 rounded-2xl bg-gradient-to-b from-[#ffe8b3] to-[#ffd27a] border-4 border-[#2c2f4a] opacity-90" />
      <div className="absolute top-14 right-10 text-3xl opacity-80">☁️</div>
      {/* shelf */}
      <div className="absolute top-24 right-6 w-16 h-3 bg-[#2c2f4a] rounded-full" />
      <div className="absolute top-16 right-8 text-2xl">🪴</div>
      {/* floor */}
      <div className="absolute bottom-[72px] left-0 right-0 h-24 bg-[#2c2f4a]" />
      <div className="absolute bottom-[72px] left-1/2 -translate-x-1/2 w-40 h-8 bg-[#7b6cd9] rounded-full opacity-60" />

      <div className="absolute bottom-[130px] left-1/2 -translate-x-1/2">
        <div className="relative">
          <SpeechBubble text={listening ? "listening..." : thinking ? "hmm..." : speech} />
          <div className={curious ? "anim-tilt" : ""}>
            <BitBotCharacter
              ref={botRef}
              mood={mood}
              blink={blink}
              scale={1.35}
              listening={listening}
              onTapHead={onTapHead}
              onTapBelly={onTapBelly}
              onTapAntenna={onTapAntenna}
              onPressStart={onPressStart}
              onPressEnd={onPressEnd}
            />
          </div>
        </div>
      </div>

      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex gap-2 z-20 pointer-events-none">
        <div className="px-3 py-1 rounded-full bg-black/25 backdrop-blur text-white/80 text-[10px] font-bold">⚡ {Math.round(stats.energy)}%</div>
        <div className="px-3 py-1 rounded-full bg-black/25 backdrop-blur text-white/80 text-[10px] font-bold">💚 {Math.round(stats.happiness)}%</div>
      </div>

      <button
        onClick={onMic}
        disabled={listening || thinking}
        className={`absolute bottom-[92px] right-5 w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform ${
          listening ? "bg-[#f4665a]" : "bg-[#6ee7c9]"
        }`}
      >
        <Mic size={18} className="text-[#0d3b32]" />
      </button>
    </div>
  );
}

/* ---------------- Food ---------------- */

function FoodScreen({ roomRef, botRef, mood, blink, speech, chewing, flyingFood, onFoodArrive, onPick, onBack }) {
  return (
    <div ref={roomRef} className="relative w-full h-full bg-gradient-to-b from-[#3f5a4a] via-[#4b6c56] to-[#5c8267] overflow-hidden">
      <button onClick={onBack} className="absolute top-4 left-4 z-30 w-9 h-9 rounded-full bg-black/30 flex items-center justify-center">
        <X size={16} className="text-white" />
      </button>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/90 text-sm font-bold z-10">Feeding Time</div>

      {/* counter */}
      <div className="absolute bottom-[72px] left-0 right-0 h-28 bg-[#2f4438]" />

      <div className="absolute bottom-[150px] left-1/2 -translate-x-1/2">
        <div className="relative">
          <SpeechBubble text={speech} />
          <BitBotCharacter ref={botRef} mood={mood} blink={blink} scale={1.05} chewing={chewing} />
        </div>
      </div>

      {flyingFood && (
        <div
          onTransitionEnd={onFoodArrive}
          className="absolute text-3xl z-20"
          style={{
            left: flyingFood.landed ? flyingFood.endX : flyingFood.startX,
            top: flyingFood.landed ? flyingFood.endY : flyingFood.startY,
            transform: "translate(-50%, -50%)",
            transition: "left 0.55s ease-in, top 0.55s ease-in",
          }}
        >
          {flyingFood.emoji}
        </div>
      )}

      <div className="absolute bottom-[84px] left-0 right-0 flex justify-center gap-3 px-4 z-10">
        {FOOD_ITEMS.map((food) => (
          <button
            id={`food-${food.id}`}
            key={food.id}
            onClick={() => onPick(food)}
            className="w-12 h-12 rounded-2xl bg-white/90 flex items-center justify-center text-2xl shadow-md active:scale-90 transition-transform"
          >
            {food.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Clean ---------------- */

function CleanScreen({ botRef, mood, blink, dirtSpots, spongePos, onMove, allClean, onBack }) {
  return (
    <div
      onPointerMove={onMove}
      className="relative w-full h-full bg-gradient-to-b from-[#6fb3c9] via-[#7fc4d6] to-[#9adbe5] overflow-hidden cursor-none"
    >
      <button onClick={onBack} className="absolute top-4 left-4 z-30 w-9 h-9 rounded-full bg-black/25 flex items-center justify-center">
        <X size={16} className="text-white" />
      </button>
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/90 text-sm font-bold z-10">
        {allClean ? "All clean!" : "Swipe over BitBot to clean him"}
      </div>

      <div className="absolute bottom-[130px] left-1/2 -translate-x-1/2">
        <div className="relative">
          <BitBotCharacter ref={botRef} mood={mood} blink={blink} scale={1.2} dirty={!allClean && dirtSpots.some((s) => !s.cleaned)} />
          {dirtSpots.map(
            (sp) =>
              !sp.cleaned && (
                <div
                  key={sp.id}
                  className="absolute w-4 h-4 rounded-full bg-lime-800/50 border border-lime-900/40"
                  style={{ left: `${sp.x}%`, top: `${sp.y}%`, transform: "translate(-50%,-50%)" }}
                />
              )
          )}
        </div>
      </div>

      {spongePos && (
        <div
          className="absolute w-10 h-10 text-3xl pointer-events-none z-30 anim-sparkle"
          style={{ left: `${spongePos.x}%`, top: `${spongePos.y}%`, transform: "translate(-50%,-50%)" }}
        >
          🧽
        </div>
      )}

      {allClean && (
        <button
          onClick={onBack}
          className="absolute bottom-[92px] left-1/2 -translate-x-1/2 bg-white text-[#0d3b32] font-bold px-6 py-2.5 rounded-full shadow-lg z-30"
        >
          All done ✨
        </button>
      )}
    </div>
  );
}

/* ---------------- Sleep ---------------- */

function SleepScreen({ mood, stage, energy, onWake, onBack }) {
  const walked = stage !== "walking";
  return (
    <div className="relative w-full h-full bg-gradient-to-b from-[#1a1c33] via-[#22254a] to-[#2b2f5c] overflow-hidden">
      {onBack && (
        <button onClick={onBack} className="absolute top-4 left-4 z-30 w-9 h-9 rounded-full bg-black/25 flex items-center justify-center">
          <X size={16} className="text-white" />
        </button>
      )}
      {/* stars */}
      {stage !== "waking" && (
        <>
          <div className="absolute top-10 left-10 text-white/60 text-xs">✦</div>
          <div className="absolute top-16 right-16 text-white/50 text-xs">✦</div>
          <div className="absolute top-24 left-1/3 text-white/40 text-[10px]">✦</div>
        </>
      )}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-white/80 text-sm font-bold z-10">
        {stage === "sleeping" ? "Zzz... recharging..." : stage === "waking" ? "Rise and shine!" : "Bedtime"}
      </div>

      {/* bed */}
      <div className="absolute bottom-[100px] left-1/2 -translate-x-1/2 w-44 h-16 bg-[#e0699a]/70 rounded-3xl border-4 border-[#c14f80]" />

      <div
        className="absolute bottom-[104px] transition-all duration-[1200ms] ease-in-out"
        style={{ left: walked ? "50%" : "20%", transform: "translateX(-50%)" }}
      >
        <BitBotCharacter
          mood={stage === "sleeping" ? "sleepy" : stage === "yawning" ? "sleepy" : mood}
          blink={false}
          scale={stage === "inbed" || stage === "sleeping" ? 0.9 : 1.05}
        />
      </div>

      {stage === "sleeping" && (
        <div className="absolute bottom-[60px] left-0 right-0 px-8 z-10">
          <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full bg-[#6ee7c9] transition-all duration-500" style={{ width: `${energy}%` }} />
          </div>
          <button onClick={onWake} className="mt-4 mx-auto block text-xs font-semibold text-white/70 underline">
            wake up early
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Games menu ---------------- */

function GamesMenu({ onPick, onBack }) {
  const games = [
    { id: "game-spark", title: "Spark Catch", desc: "Tap the sparks fast!", emoji: "✨" },
    { id: "game-catch", title: "Battery Drop", desc: "Catch falling batteries", emoji: "🔋" },
  ];
  return (
    <div className="relative w-full h-full bg-gradient-to-b from-[#2c2f4a] to-[#1c1e33] pb-[72px] flex flex-col">
      <div className="text-center text-white font-bold text-base pt-6 pb-4">Mini-Games</div>
      <div className="flex-1 px-5 flex flex-col gap-4">
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => onPick(g.id)}
            className="bg-white/10 rounded-3xl p-5 flex items-center gap-4 active:scale-95 transition-transform"
          >
            <div className="text-4xl">{g.emoji}</div>
            <div className="text-left">
              <div className="text-white font-bold text-sm">{g.title}</div>
              <div className="text-white/60 text-xs">{g.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniGame({ title, instructions, variant, onEarn, onDone }) {
  const [timeLeft, setTimeLeft] = useState(14);
  const [score, setScore] = useState(0);
  const [ended, setEnded] = useState(false);
  const [pos, setPos] = useState({ x: 45, y: 45 });
  const [pop, setPop] = useState(false);
  const [drops, setDrops] = useState([]);
  const dropId = useRef(0);
  const spawnTimer = useRef(null);

  useEffect(() => {
    if (timeLeft <= 0) {
      setEnded(true);
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const randomSparkPos = useCallback(() => setPos({ x: 15 + Math.random() * 65, y: 15 + Math.random() * 60 }), []);

  const hitSpark = () => {
    if (ended) return;
    setScore((s) => s + 1);
    setPop(true);
    setTimeout(() => setPop(false), 140);
    randomSparkPos();
  };

  useEffect(() => {
    if (variant !== "catch" || ended) return;
    spawnTimer.current = setInterval(() => {
      const id = dropId.current++;
      const x = 10 + Math.random() * 80;
      setDrops((d) => [...d, { id, x }]);
      setTimeout(() => setDrops((d) => d.filter((it) => it.id !== id)), 2200);
    }, 700);
    return () => clearInterval(spawnTimer.current);
  }, [variant, ended]);

  const catchDrop = (id) => {
    setDrops((d) => d.filter((it) => it.id !== id));
    setScore((s) => s + 1);
  };

  const finish = () => {
    onEarn(score);
    onDone();
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-[#2c2f4a] to-[#1c1e33] pb-[72px] flex flex-col">
      <div className="flex items-center justify-between px-5 pt-6">
        <button onClick={onDone} className="text-white/60 text-xs font-semibold">
          ✕ quit
        </button>
        <span className="text-sm font-bold text-white bg-white/10 rounded-full px-3 py-1.5">⏱ {timeLeft}s</span>
      </div>
      <div className="text-center text-white font-bold text-base mt-2">{title}</div>
      <p className="text-center text-white/50 text-xs mb-2">{instructions}</p>

      <div className="relative flex-1 mx-4 mb-3 rounded-3xl bg-black/20 overflow-hidden">
        <div className="absolute top-3 left-3 text-white text-sm font-bold z-10">😊 {score}</div>

        {!ended && variant === "spark" && (
          <button
            onClick={hitSpark}
            className={`absolute w-12 h-12 rounded-full bg-yellow-300 flex items-center justify-center text-xl transition-transform ${pop ? "scale-125" : "scale-100"}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, boxShadow: "0 0 20px 6px rgba(253,224,71,0.6)" }}
          >
            ✨
          </button>
        )}

        {!ended &&
          variant === "catch" &&
          drops.map((d) => (
            <button
              key={d.id}
              onClick={() => catchDrop(d.id)}
              className="absolute w-10 h-10 text-2xl flex items-center justify-center"
              style={{ left: `${d.x}%`, top: 0, animation: "fallDown 2.2s linear forwards" }}
            >
              🔋
            </button>
          ))}

        {ended && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p className="text-white font-bold text-lg">Nice! Score: {score}</p>
            <button onClick={finish} className="bg-[#6ee7c9] text-[#0d3b32] font-bold px-5 py-2 rounded-full active:scale-95 transition-transform">
              Back to BitBot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
