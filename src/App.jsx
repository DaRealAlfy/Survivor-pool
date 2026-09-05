import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ref, onValue, set as fbSet } from "firebase/database";
import { onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut } from "firebase/auth";
import { db, auth } from "./firebase";
import { Plus, Trash2, DollarSign, Check, X, Lock, Unlock, Flame, TrendingDown, BarChart3, ExternalLink, RefreshCw, Loader2, ChevronDown, Skull, Eye, EyeOff, Swords, Clock } from "lucide-react";

const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);
const BUY_IN = 50;

const SEASON_WEEK1_SUNDAY_UTC = Date.UTC(2026, 8, 13);
const DST_END_UTC_2026 = Date.UTC(2026, 10, 1);

function weekLockTimestamp(week) {
  const sundayUTCms = SEASON_WEEK1_SUNDAY_UTC + (week - 1) * 7 * 24 * 3600 * 1000;
  const offsetHours = sundayUTCms >= DST_END_UTC_2026 ? 5 : 4;
  return sundayUTCms + (13 + offsetHours) * 3600 * 1000;
}
function isWeekLockedByTime(week) {
  return Date.now() >= weekLockTimestamp(week);
}
function formatLockTime(week) {
  return (
    new Date(weekLockTimestamp(week)).toLocaleString("en-US", {
      timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    }) + " ET"
  );
}

const TEAMS = [
  { abbr: "ARI", name: "Cardinals", city: "Arizona", primary: "#97233F", secondary: "#000000" },
  { abbr: "ATL", name: "Falcons", city: "Atlanta", primary: "#A71930", secondary: "#000000" },
  { abbr: "BAL", name: "Ravens", city: "Baltimore", primary: "#241773", secondary: "#9E7C0C" },
  { abbr: "BUF", name: "Bills", city: "Buffalo", primary: "#00338D", secondary: "#C60C30" },
  { abbr: "CAR", name: "Panthers", city: "Carolina", primary: "#0085CA", secondary: "#101820" },
  { abbr: "CHI", name: "Bears", city: "Chicago", primary: "#0B162A", secondary: "#C83803" },
  { abbr: "CIN", name: "Bengals", city: "Cincinnati", primary: "#FB4F14", secondary: "#000000" },
  { abbr: "CLE", name: "Browns", city: "Cleveland", primary: "#311D00", secondary: "#FF3C00" },
  { abbr: "DAL", name: "Cowboys", city: "Dallas", primary: "#003594", secondary: "#869397" },
  { abbr: "DEN", name: "Broncos", city: "Denver", primary: "#FB4F14", secondary: "#002244" },
  { abbr: "DET", name: "Lions", city: "Detroit", primary: "#0076B6", secondary: "#B0B7BC" },
  { abbr: "GB", name: "Packers", city: "Green Bay", primary: "#203731", secondary: "#FFB612" },
  { abbr: "HOU", name: "Texans", city: "Houston", primary: "#03202F", secondary: "#A71930" },
  { abbr: "IND", name: "Colts", city: "Indianapolis", primary: "#002C5F", secondary: "#A2AAAD" },
  { abbr: "JAX", name: "Jaguars", city: "Jacksonville", primary: "#101820", secondary: "#D7A22A" },
  { abbr: "KC", name: "Chiefs", city: "Kansas City", primary: "#E31837", secondary: "#FFB81C" },
  { abbr: "LV", name: "Raiders", city: "Las Vegas", primary: "#000000", secondary: "#A5ACAF" },
  { abbr: "LAC", name: "Chargers", city: "LA", primary: "#0080C6", secondary: "#FFC20E" },
  { abbr: "LAR", name: "Rams", city: "LA", primary: "#003594", secondary: "#FFA300" },
  { abbr: "MIA", name: "Dolphins", city: "Miami", primary: "#008E97", secondary: "#FC4C02" },
  { abbr: "MIN", name: "Vikings", city: "Minnesota", primary: "#4F2683", secondary: "#FFC62F" },
  { abbr: "NE", name: "Patriots", city: "New England", primary: "#002244", secondary: "#C60C30" },
  { abbr: "NO", name: "Saints", city: "New Orleans", primary: "#D3BC8D", secondary: "#101820" },
  { abbr: "NYG", name: "Giants", city: "NY", primary: "#0B2265", secondary: "#A71930" },
  { abbr: "NYJ", name: "Jets", city: "NY", primary: "#125740", secondary: "#000000" },
  { abbr: "PHI", name: "Eagles", city: "Philadelphia", primary: "#004C54", secondary: "#A5ACAF" },
  { abbr: "PIT", name: "Steelers", city: "Pittsburgh", primary: "#FFB612", secondary: "#101820" },
  { abbr: "SF", name: "49ers", city: "San Francisco", primary: "#AA0000", secondary: "#B3995D" },
  { abbr: "SEA", name: "Seahawks", city: "Seattle", primary: "#002244", secondary: "#69BE28" },
  { abbr: "TB", name: "Buccaneers", city: "Tampa Bay", primary: "#D50A0A", secondary: "#34302B" },
  { abbr: "TEN", name: "Titans", city: "Tennessee", primary: "#0C2340", secondary: "#4B92DB" },
  { abbr: "WSH", name: "Commanders", city: "Washington", primary: "#5A1414", secondary: "#FFB612" },
];
const TEAM_MAP = Object.fromEntries(TEAMS.map((t) => [t.abbr, t]));

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function computeStatus(member) {
  let lives = 2;
  let eliminatedAtWeek = null;
  for (const w of WEEKS) {
    if (eliminatedAtWeek !== null) break;
    const pick = member.picks[w];
    if (pick && pick.result === "loss") {
      lives -= 1;
      if (lives <= 0) eliminatedAtWeek = w;
    }
  }
  return { lives: Math.max(lives, 0), eliminatedAtWeek, eliminated: eliminatedAtWeek !== null };
}

function textColorFor(hex) {
  if (!hex) return "#fff";
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#12190F" : "#F5F3EA";
}

function TeamChip({ abbr, size = "md" }) {
  const team = TEAM_MAP[abbr];
  if (!team) return null;
  const fg = textColorFor(team.primary);
  const dims = size === "sm" ? { h: 30, fs: 11, pad: "0 9px" } : { h: 38, fs: 13, pad: "0 12px" };
  return (
    <span className="team-chip" style={{ background: team.primary, color: fg, borderColor: team.secondary, height: dims.h, fontSize: dims.fs, padding: dims.pad }} title={`${team.city} ${team.name}`}>
      {abbr}
    </span>
  );
}

export default function App() {
  const [members, setMembers] = useState([]);
  const [teamStats, setTeamStats] = useState({});
  const [matchupsByWeek, setMatchupsByWeek] = useState({});
  const [weekOverrides, setWeekOverrides] = useState({});
  const [poolLoaded, setPoolLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [memberSession, setMemberSession] = useState(null);
  const [newName, setNewName] = useState("");
  const [picker, setPicker] = useState(null);
  const [statsOpen, setStatsOpen] = useState(true);
  const [vsOpen, setVsOpen] = useState(true);
  const [winPctOpen, setWinPctOpen] = useState(false);
  const [checking, setChecking] = useState(null);
  const [checkMsg, setCheckMsg] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

    const hostUnlocked = !!user && !user.isAnonymous;

    useEffect(() => {
    const poolRef = ref(db, "pool");
    const unsub = onValue(poolRef, (snap) => {
      const val = snap.val() || {};
      const rawMembers = Array.isArray(val.members) ? val.members : Object.values(val.members || {});
      const normalizedMembers = rawMembers.map((m) => ({
        ...m,
        picks: m && m.picks ? m.picks : {},
        passcode: m && m.passcode ? m.passcode : null,
      }));
      setMembers(normalizedMembers);
      setTeamStats(val.teamStats || {});
      setMatchupsByWeek(val.matchupsByWeek || {});
      setWeekOverrides(val.weekOverrides || {});
      setPoolLoaded(true);
    });
    return () => unsub();
  }, []);

    useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setAuthChecked(true);
        if (!u.isAnonymous) setMemberSession(null);
      } else {
        // Nobody signed in yet (first load, or just signed out as host) —
        // sign in anonymously so regular visitors and team members can still save data.
        signInAnonymously(auth).catch((e) => {
          console.error("Anonymous sign-in failed", e);
          setAuthChecked(true);
        });
      }
    });
    return () => unsub();
  }, []);

  const pushMembers = useCallback((next) => {
    setMembers(next);
    fbSet(ref(db, "pool/members"), next).catch((e) => console.error("write failed", e));
  }, []);
  const pushTeamStats = useCallback((next) => {
    setTeamStats(next);
    fbSet(ref(db, "pool/teamStats"), next).catch((e) => console.error("write failed", e));
  }, []);
  const pushMatchups = useCallback((next) => {
    setMatchupsByWeek(next);
    fbSet(ref(db, "pool/matchupsByWeek"), next).catch((e) => console.error("write failed", e));
  }, []);
  const pushOverrides = useCallback((next) => {
    setWeekOverrides(next);
    fbSet(ref(db, "pool/weekOverrides"), next).catch((e) => console.error("write failed", e));
  }, []);

  const effectiveLocked = useCallback(
    (week) => {
      const ov = weekOverrides[week];
      if (ov === "locked") return true;
      if (ov === "unlocked") return false;
      return isWeekLockedByTime(week);
    },
    [weekOverrides]
  );

  function cycleWeekOverride(week) {
    const cur = weekOverrides[week];
    const next = cur === undefined ? "locked" : cur === "locked" ? "unlocked" : undefined;
    const copy = { ...weekOverrides };
    if (next === undefined) delete copy[week];
    else copy[week] = next;
    pushOverrides(copy);
  }

  const getVisiblePick = useCallback(
    (member, week) => {
      const pick = member.picks[week];
      if (!pick) return null;
      if (hostUnlocked || memberSession === member.id || effectiveLocked(week)) return pick;
      return "hidden";
    },
    [hostUnlocked, memberSession, effectiveLocked]
  );

  async function submitLogin() {
    setLoginError("");
    setLoginBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setLoginOpen(false);
      setEmail("");
      setPassword("");
    } catch (e) {
      setLoginError("Couldn't sign in — check the email and password.");
    } finally {
      setLoginBusy(false);
    }
  }

  function claimOrSignInMember(memberId, code) {
    const target = members.find((m) => m.id === memberId);
    if (!target) return "No team selected.";
    if (!target.passcode) {
      pushMembers(members.map((x) => (x.id === memberId ? { ...x, passcode: code } : x)));
      setMemberSession(memberId);
      setTeamModalOpen(false);
      return null;
    }
    if (target.passcode === code) {
      setMemberSession(memberId);
      setTeamModalOpen(false);
      return null;
    }
    return "Incorrect code for that team.";
  }

  function signOutAll() {
    setMemberSession(null);
    if (hostUnlocked) signOut(auth);
  }

  function addMember() {
    const name = newName.trim();
    if (!name) return;
    pushMembers([...members, { id: uid(), name, paid: false, picks: {}, passcode: null }]);
    setNewName("");
  }
  function deleteMember(id) {
    pushMembers(members.filter((x) => x.id !== id));
    if (memberSession === id) setMemberSession(null);
  }
  function renameMember(id, name) {
    pushMembers(members.map((x) => (x.id === id ? { ...x, name } : x)));
  }
  function togglePaid(id) {
    pushMembers(members.map((x) => (x.id === id ? { ...x, paid: !x.paid } : x)));
  }
  function resetPasscode(id) {
    pushMembers(members.map((x) => (x.id === id ? { ...x, passcode: null } : x)));
  }
  function selectTeam(memberId, week, abbr) {
    pushMembers(members.map((x) => (x.id === memberId ? { ...x, picks: { ...x.picks, [week]: { team: abbr, result: "pending" } } } : x)));
    setPicker(null);
  }
  function clearPick(memberId, week) {
    pushMembers(
      members.map((x) => {
        if (x.id !== memberId) return x;
        const picks = { ...x.picks };
        delete picks[week];
        return { ...x, picks };
      })
    );
    setPicker(null);
  }
  function setResult(memberId, week, result) {
    pushMembers(
      members.map((x) => {
        if (x.id !== memberId) return x;
        const existing = x.picks[week];
        if (!existing) return x;
        const nextResult = existing.result === result ? "pending" : result;
        return { ...x, picks: { ...x.picks, [week]: { ...existing, result: nextResult } } };
      })
    );
  }
  function setWinPct(abbr, val) {
    pushTeamStats({ ...teamStats, [abbr]: val });
  }

  const statuses = useMemo(() => {
    const map = {};
    for (const m of members) map[m.id] = computeStatus(m);
    return map;
  }, [members]);

  const pot = members.length * BUY_IN;
  const paidCount = members.filter((m) => m.paid).length;
  const paidTotal = paidCount * BUY_IN;
  const aliveCount = members.filter((m) => !statuses[m.id]?.eliminated).length;

  const teamPickCounts = useMemo(() => {
    const counts = {};
    for (const m of members) {
      for (const w of WEEKS) {
        const vp = getVisiblePick(m, w);
        if (vp && vp !== "hidden") counts[vp.team] = (counts[vp.team] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [members, getVisiblePick]);

  const boldestPickers = useMemo(() => {
    const rows = members.map((m) => {
      const visiblePicks = WEEKS.map((w) => getVisiblePick(m, w)).filter((p) => p && p !== "hidden");
      const withPct = visiblePicks.filter((p) => typeof teamStats[p.team] === "number");
      if (withPct.length === 0) return { id: m.id, name: m.name, avg: null };
      const avg = withPct.reduce((s, p) => s + teamStats[p.team], 0) / withPct.length;
      return { id: m.id, name: m.name, avg };
    });
    return rows.filter((r) => r.avg !== null).sort((a, b) => a.avg - b.avg);
  }, [members, teamStats, getVisiblePick]);

  const headToHead = useMemo(() => {
    const results = {};
    for (const w of WEEKS) {
      const pairs = matchupsByWeek[w] || [];
      if (pairs.length === 0) continue;
      const pickers = {};
      for (const m of members) {
        const vp = getVisiblePick(m, w);
        if (vp && vp !== "hidden") {
          pickers[vp.team] = pickers[vp.team] || [];
          pickers[vp.team].push(m);
        }
      }
      const weekMatches = [];
      for (const pair of pairs) {
        const [teamA, teamB] = Array.isArray(pair) ? pair : [pair.away, pair.home];
        const pickersA = pickers[teamA] || [];
        const pickersB = pickers[teamB] || [];
        if (pickersA.length && pickersB.length) {
          for (const ma of pickersA) for (const mb of pickersB) weekMatches.push({ teamA, teamB, memberA: ma, memberB: mb });
        }
      }
      if (weekMatches.length) results[w] = weekMatches;
    }
    return results;
  }, [members, matchupsByWeek, getVisiblePick]);

  const vsCellKeys = useMemo(() => {
    const set = new Set();
    for (const [wStr, matches] of Object.entries(headToHead)) {
      for (const match of matches) {
        set.add(`${match.memberA.id}-${wStr}`);
        set.add(`${match.memberB.id}-${wStr}`);
      }
    }
    return set;
  }, [headToHead]);

  async function checkWeekLive(week) {
    setChecking(week);
    setCheckMsg((s) => ({ ...s, [week]: null }));
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=2026`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Bad response " + resp.status);
      const data = await resp.json();
      const winners = {};
      let completedGames = 0;
      for (const event of data.events || []) {
        const comp = event.competitions?.[0];
        if (!comp || !comp.status?.type?.completed) continue;
        completedGames += 1;
        for (const c of comp.competitors || []) {
          const abbr = c.team?.abbreviation;
          if (!abbr) continue;
          winners[abbr] = c.winner === true;
        }
      }
      if (completedGames === 0) {
        setCheckMsg((s) => ({ ...s, [week]: { type: "info", text: "No completed games found for that week yet." } }));
        setChecking(null);
        return;
      }
      let updated = 0;
      const next = members.map((x) => {
        const pick = x.picks[week];
        if (!pick) return x;
        const norm = pick.team === "WAS" ? "WSH" : pick.team;
        if (!(norm in winners)) return x;
        const result = winners[norm] ? "win" : "loss";
        if (pick.result === result) return x;
        updated += 1;
        return { ...x, picks: { ...x.picks, [week]: { ...pick, result } } };
      });
      pushMembers(next);
      setCheckMsg((s) => ({ ...s, [week]: { type: "success", text: `Checked ${completedGames} completed game${completedGames === 1 ? "" : "s"} — ${updated} pick${updated === 1 ? "" : "s"} updated.` } }));
    } catch (e) {
      setCheckMsg((s) => ({ ...s, [week]: { type: "error", text: "Couldn't reach live scores from here. Use \"Open scoreboard\" to check manually and mark picks with the check / X buttons." } }));
    } finally {
      setChecking(null);
    }
  }

  async function syncSchedule() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const next = {};
      for (const w of WEEKS) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${w}&seasontype=2&year=2026`;
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const data = await resp.json();
        const pairs = [];
        for (const event of data.events || []) {
          const comp = event.competitions?.[0];
          const abbrs = (comp?.competitors || []).map((c) => c.team?.abbreviation).filter(Boolean);
          if (abbrs.length === 2) pairs.push(abbrs);
        }
        next[w] = pairs;
      }
      pushMatchups(next);
      const totalGames = Object.values(next).reduce((s, p) => s + p.length, 0);
      setSyncMsg(`Synced ${totalGames} games across ${WEEKS.length} weeks.`);
    } catch (e) {
      setSyncMsg("Couldn't reach the schedule from here — try again later.");
    } finally {
      setSyncing(false);
    }
  }

  function openScoreboard(week) {
    window.open(`https://www.espn.com/nfl/scoreboard/_/week/${week}/year/2026/seasontype/2`, "_blank", "noopener,noreferrer");
  }

  const maxPickCount = teamPickCounts[0]?.[1] || 1;
  const sessionMember = memberSession ? members.find((m) => m.id === memberSession) : null;
  const loaded = poolLoaded && authChecked;

  return (
    <div className="sp-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
        .sp-root {
          --bg: #0E1F17; --surface: #16281F; --surface-2: #1D3327; --surface-3: #24402F; --line: #2C4A3A;
          --text: #F3F1E7; --text-dim: #9FB4A6; --gold: #E8B23D; --gold-dim: #B9862A;
          --danger: #D9645B; --danger-dim: #7A2E29; --success: #5FB37F; --success-dim: #2D5B3D;
          font-family: 'Inter', system-ui, sans-serif; background: radial-gradient(ellipse at top, #163325 0%, var(--bg) 55%);
          color: var(--text); min-height: 100vh; padding: 28px 20px 60px; box-sizing: border-box;
        }
        .sp-root * { box-sizing: border-box; }
        .sp-display { font-family: 'Oswald', sans-serif; }
        .sp-shell { max-width: 1180px; margin: 0 auto; }
        .sp-hostbar { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
        .sp-readonly-badge { font-size: 11.5px; color: var(--text-dim); display: flex; align-items: center; gap: 6px; border: 1px solid var(--line); padding: 5px 10px; border-radius: 20px; margin-right: auto; }
        .sp-hero { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 20px; border-bottom: 1px solid var(--line); padding-bottom: 22px; margin-bottom: 24px; }
        .sp-title { font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--gold); font-weight: 600; margin-bottom: 6px; }
        .sp-h1 { font-family: 'Oswald', sans-serif; font-size: 40px; font-weight: 700; line-height: 1; margin: 0; letter-spacing: 0.01em; }
        .sp-sub { color: var(--text-dim); font-size: 14px; margin-top: 6px; }
        .sp-pot { text-align: right; }
        .sp-pot-num { font-family: 'Oswald', sans-serif; font-size: 48px; font-weight: 700; color: var(--gold); line-height: 1; }
        .sp-pot-label { font-size: 12px; color: var(--text-dim); margin-top: 4px; }
        .sp-pot-sub { font-size: 12.5px; color: var(--text-dim); margin-top: 2px; }
        .sp-panel { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 20px; margin-bottom: 22px; }
        .sp-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .sp-panel-title { font-family: 'Oswald', sans-serif; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .sp-add-row { display: flex; gap: 10px; margin-bottom: 16px; }
        .sp-input { background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; color: var(--text); padding: 9px 12px; font-size: 14px; font-family: inherit; outline: none; }
        .sp-input:focus { border-color: var(--gold-dim); }
        .sp-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--gold); color: #1B1305; border: none; border-radius: 8px; padding: 9px 16px; font-weight: 600; font-size: 13.5px; cursor: pointer; font-family: inherit; }
        .sp-btn:hover { background: #f0bf52; }
        .sp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sp-btn-ghost { background: transparent; border: 1px solid var(--line); color: var(--text); }
        .sp-btn-ghost:hover { border-color: var(--gold-dim); background: var(--surface-2); }
        .sp-btn-sm { padding: 6px 11px; font-size: 12.5px; }
        .sp-members-list { display: flex; flex-direction: column; gap: 8px; }
        .sp-member-row { display: flex; align-items: center; gap: 12px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; flex-wrap: wrap; }
        .sp-member-name { background: transparent; border: none; color: var(--text); font-size: 14.5px; font-weight: 600; font-family: inherit; flex: 1; min-width: 90px; outline: none; border-bottom: 1px solid transparent; }
        .sp-member-name:focus { border-bottom: 1px solid var(--gold-dim); }
        .sp-paid-toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 5px 10px; border-radius: 20px; border: 1px solid var(--line); white-space: nowrap; user-select: none; }
        .sp-paid-yes { background: var(--success-dim); border-color: var(--success); color: #CFF0DA; }
        .sp-paid-no { background: var(--danger-dim); border-color: var(--danger); color: #F6D8D5; }
        .sp-login-badge { font-size: 11px; padding: 4px 9px; border-radius: 20px; border: 1px solid var(--line); color: var(--text-dim); display: flex; align-items: center; gap: 5px; white-space: nowrap; }
        .sp-icon-btn { background: transparent; border: none; color: var(--text-dim); cursor: pointer; padding: 6px; border-radius: 6px; display: flex; }
        .sp-icon-btn:hover { color: var(--danger); background: rgba(217,100,91,0.12); }
        .sp-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .sp-empty { color: var(--text-dim); font-size: 13.5px; padding: 10px 2px; }
        .sp-grid-scroll { overflow-x: auto; border-radius: 10px; border: 1px solid var(--line); }
        table.sp-grid { border-collapse: separate; border-spacing: 0; width: 100%; }
        table.sp-grid th, table.sp-grid td { border-bottom: 1px solid var(--line); }
        .sp-col-week { font-family: 'Oswald', sans-serif; font-size: 12.5px; color: var(--text-dim); text-align: center; padding: 10px 6px; min-width: 76px; background: var(--surface-2); border-left: 1px solid var(--line); font-weight: 500; letter-spacing: 0.04em; }
        .sp-week-lock { display: flex; justify-content: center; color: var(--text-dim); margin-top: 3px; }
        .sp-col-check { padding-bottom: 6px; }
        .sp-sticky-name { position: sticky; left: 0; z-index: 2; background: var(--surface-2); padding: 10px 14px; min-width: 168px; text-align: left; border-right: 1px solid var(--line); }
        .sp-sticky-name-cell { position: sticky; left: 0; z-index: 1; background: var(--surface); padding: 10px 14px; border-right: 1px solid var(--line); }
        .sp-row-eliminated .sp-sticky-name-cell { background: #17251D; }
        .sp-row-mine .sp-sticky-name-cell { background: #22301F; }
        .sp-member-cell-name { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px; }
        .sp-lives { display: flex; gap: 4px; margin-top: 4px; }
        .sp-life-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); }
        .sp-elim-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--danger); margin-top: 4px; font-weight: 600; letter-spacing: 0.03em; }
        .sp-cell { text-align: center; padding: 8px 6px; border-left: 1px solid var(--line); vertical-align: middle; }
        .sp-cell.locked { background: repeating-linear-gradient(135deg, #101d16, #101d16 6px, #142117 6px, #142117 12px); }
        .sp-cell.vs { box-shadow: inset 0 0 0 2px var(--gold); background: rgba(232,178,61,0.09); }
        .sp-cell-inner { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .team-chip { display: inline-flex; align-items: center; justify-content: center; border-radius: 7px; border: 2px solid; font-family: 'Oswald', sans-serif; font-weight: 600; letter-spacing: 0.03em; }
        .sp-pick-empty { width: 38px; height: 38px; border-radius: 7px; border: 1.5px dashed var(--line); color: var(--text-dim); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; background: transparent; }
        .sp-pick-empty:hover { border-color: var(--gold-dim); color: var(--gold); }
        .sp-hidden-pick { width: 38px; height: 30px; border-radius: 7px; border: 1.5px dashed var(--line); color: var(--text-dim); display: flex; align-items: center; justify-content: center; }
        .sp-result-row { display: flex; gap: 3px; }
        .sp-result-btn { width: 20px; height: 20px; border-radius: 5px; border: 1px solid var(--line); background: var(--surface-2); color: var(--text-dim); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .sp-result-btn.win-active { background: var(--success-dim); border-color: var(--success); color: #CFF0DA; }
        .sp-result-btn.loss-active { background: var(--danger-dim); border-color: var(--danger); color: #F6D8D5; }
        .sp-locked-icon { color: #45594E; }
        .sp-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        @media (max-width: 760px) { .sp-stats-grid { grid-template-columns: 1fr; } }
        .sp-stat-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; }
        .sp-stat-row:last-child { border-bottom: none; }
        .sp-rank { font-family: 'Oswald', sans-serif; color: var(--gold); width: 20px; font-size: 13px; font-weight: 600; }
        .sp-bar-track { flex: 1; height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden; }
        .sp-bar-fill { height: 100%; background: var(--gold-dim); }
        .sp-stat-val { font-family: 'Oswald', sans-serif; font-size: 13px; color: var(--text-dim); min-width: 40px; text-align: right; }
        .sp-vs-week { margin-bottom: 12px; }
        .sp-vs-week:last-child { margin-bottom: 0; }
        .sp-vs-week-label { font-family: 'Oswald', sans-serif; font-size: 12.5px; color: var(--gold); margin-bottom: 6px; letter-spacing: 0.03em; }
        .sp-vs-row { display: flex; align-items: center; gap: 10px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; margin-bottom: 6px; font-size: 13.5px; }
        .sp-vs-row:last-child { margin-bottom: 0; }
        .sp-vs-name { font-weight: 600; }
        .sp-pct-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-top: 12px; }
        .sp-pct-item { display: flex; align-items: center; gap: 8px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; }
        .sp-pct-input { width: 52px; background: var(--surface); border: 1px solid var(--line); border-radius: 5px; color: var(--text); font-family: inherit; font-size: 12.5px; padding: 3px 5px; text-align: right; }
        .sp-pct-input:disabled { opacity: 0.5; }
        .sp-modal-backdrop { position: fixed; inset: 0; background: rgba(6,12,9,0.72); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
        .sp-modal { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; width: 100%; max-width: 620px; max-height: 82vh; display: flex; flex-direction: column; overflow: hidden; }
        .sp-modal.sp-modal-narrow { max-width: 380px; }
        .sp-modal-head { padding: 18px 20px 14px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; }
        .sp-modal-body { padding: 16px 20px 20px; overflow-y: auto; }
        .sp-team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
        .sp-team-btn { border-radius: 9px; border: 2px solid; padding: 9px 6px; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; line-height: 1.15; }
        .sp-team-btn small { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 9.5px; opacity: 0.85; }
        .sp-team-btn.used { opacity: 0.28; cursor: not-allowed; text-decoration: line-through; }
        .sp-modal-close { background: none; border: none; color: var(--text-dim); cursor: pointer; padding: 4px; }
        .sp-modal-close:hover { color: var(--text); }
        .sp-check-msg { font-size: 12px; margin-top: 6px; }
        .sp-check-msg.success { color: var(--success); }
        .sp-check-msg.error { color: var(--danger); }
        .sp-check-msg.info { color: var(--text-dim); }
        .sp-loading { display: flex; align-items: center; justify-content: center; padding: 60px; color: var(--text-dim); gap: 10px; }
        .sp-pin-input { width: 100%; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; color: var(--text); padding: 10px 12px; font-size: 15px; font-family: inherit; outline: none; margin-bottom: 10px; }
        .sp-pin-input:focus { border-color: var(--gold-dim); }
        .sp-pin-error { color: var(--danger); font-size: 12.5px; margin-bottom: 8px; }
        .sp-pin-note { color: var(--text-dim); font-size: 11.5px; margin-top: 12px; line-height: 1.5; }
        .sp-select { width: 100%; background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; color: var(--text); padding: 10px 12px; font-size: 14px; font-family: inherit; outline: none; margin-bottom: 10px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="sp-shell">
        {!loaded ? (
          <div className="sp-loading"><Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Loading pool…</div>
        ) : (
          <>
            <div className="sp-hostbar">
              <div className="sp-readonly-badge">
                {hostUnlocked ? (<><Unlock size={13} /> Host mode</>) : sessionMember ? (<><Eye size={13} /> Signed in as {sessionMember.name}</>) : (<><Eye size={13} /> Viewing live — read only</>)}
              </div>
              {(hostUnlocked || memberSession) && (
                <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={signOutAll}><Unlock size={13} /> Sign out</button>
              )}
              {!memberSession && (
                <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => setTeamModalOpen(true)}><Lock size={13} /> Team sign-in</button>
              )}
              {!hostUnlocked && (
                <button className="sp-btn sp-btn-ghost sp-btn-sm" onClick={() => { setLoginOpen(true); setLoginError(""); }}><Lock size={13} /> Host sign-in</button>
              )}
            </div>

            <div className="sp-hero">
              <div>
                <div className="sp-title">2026 Season</div>
                <h1 className="sp-h1 sp-display">Survivor Pool</h1>
                <div className="sp-sub">{members.length} member{members.length === 1 ? "" : "s"} · {aliveCount} still alive · ${BUY_IN} buy-in</div>
              </div>
              <div className="sp-pot">
                <div className="sp-pot-num sp-display">${pot.toLocaleString()}</div>
                <div className="sp-pot-label">Total pot</div>
                <div className="sp-pot-sub">${paidTotal.toLocaleString()} collected ({paidCount}/{members.length} paid)</div>
              </div>
            </div>

            <div className="sp-panel">
              <div className="sp-panel-head"><div className="sp-panel-title sp-display">Members</div></div>
              {hostUnlocked && (
                <div className="sp-add-row">
                  <input className="sp-input" style={{ flex: 1 }} placeholder="Add a member's name…" value={newName}
                    onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMember()} />
                  <button className="sp-btn" onClick={addMember}><Plus size={15} /> Add</button>
                </div>
              )}
              {members.length === 0 ? (
                <div className="sp-empty">No members yet{hostUnlocked ? " — add your first entrant above." : "."}</div>
              ) : (
                <div className="sp-members-list">
                  {members.map((m) => {
                    const st = statuses[m.id];
                    return (
                      <div className="sp-member-row" key={m.id}>
                        {hostUnlocked ? (
                          <input className="sp-member-name" value={m.name} onChange={(e) => renameMember(m.id, e.target.value)} />
                        ) : (
                          <div className="sp-member-name" style={{ cursor: "default" }}>{m.name}</div>
                        )}
                        {st.eliminated && <span className="sp-elim-tag" style={{ marginTop: 0 }}><Skull size={12} /> Eliminated wk {st.eliminatedAtWeek}</span>}
                        <span className="sp-login-badge">{m.passcode ? <Lock size={11} /> : <Unlock size={11} />} {m.passcode ? "Team login set" : "Not claimed yet"}</span>
                        <div className={`sp-paid-toggle ${m.paid ? "sp-paid-yes" : "sp-paid-no"}`} onClick={hostUnlocked ? () => togglePaid(m.id) : undefined} style={{ cursor: hostUnlocked ? "pointer" : "default" }}>
                          <DollarSign size={12} /> {m.paid ? "Paid" : "Unpaid"}
                        </div>
                        {hostUnlocked && (
                          <>
                            {m.passcode && <button className="sp-icon-btn" onClick={() => resetPasscode(m.id)} title="Reset this team's login so they can set a new one"><Unlock size={15} /></button>}
                            <button className="sp-icon-btn" onClick={() => deleteMember(m.id)} title="Remove member"><Trash2 size={15} /></button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {members.some((m) => !m.passcode) && (
                <div className="sp-sub" style={{ marginTop: 10 }}>
                  Members without a login yet can claim their team from "Team sign-in" above by picking their name and setting their own code.
                </div>
              )}
            </div>

            <div className="sp-panel">
              <div className="sp-panel-head"><div className="sp-panel-title sp-display">Weekly Picks</div></div>
              {members.length === 0 ? (
                <div className="sp-empty">Add members to start making picks.</div>
              ) : (
                <div className="sp-grid-scroll">
                  <table className="sp-grid">
                    <thead>
                      <tr>
                        <th className="sp-sticky-name">Member</th>
                        {WEEKS.map((w) => {
                          const locked = effectiveLocked(w);
                          const override = weekOverrides[w];
                          const overrideTitle =
                            override === "locked" ? "Host-locked — click to unlock" :
                            override === "unlocked" ? "Host-unlocked — click to reset to automatic" :
                            `Automatic — locks ${formatLockTime(w)} (click to override)`;
                          return (
                            <th className="sp-col-week" key={w}>
                              <div>W{w}</div>
                              {locked && <div className="sp-week-lock" title={`Revealed ${formatLockTime(w)}`}><Lock size={10} /></div>}
                              {hostUnlocked && (
                                <div className="sp-col-check" style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                                  <button className="sp-icon-btn" style={{ padding: 4 }} title={`Check week ${w} results live`} onClick={() => checkWeekLive(w)} disabled={checking === w}>
                                    {checking === w ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
                                  </button>
                                  <button className="sp-icon-btn" style={{ padding: 4 }} title={overrideTitle} onClick={() => cycleWeekOverride(w)}>
                                    {override === "locked" ? <Lock size={12} color="var(--gold)" /> : override === "unlocked" ? <Unlock size={12} color="var(--gold)" /> : <Clock size={12} />}
                                  </button>
                                </div>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => {
                        const st = statuses[m.id];
                        const isOwner = memberSession === m.id;
                        return (
                          <tr key={m.id} className={`${st.eliminated ? "sp-row-eliminated" : ""} ${isOwner ? "sp-row-mine" : ""}`}>
                            <td className="sp-sticky-name-cell">
                              <div className="sp-member-cell-name">{m.name}{isOwner && <Eye size={12} color="var(--gold)" />}</div>
                              <div className="sp-lives">
                                <span className="sp-life-dot" style={{ background: st.lives >= 1 ? "var(--success)" : "var(--danger-dim)" }} />
                                <span className="sp-life-dot" style={{ background: st.lives >= 2 ? "var(--success)" : "var(--danger-dim)" }} />
                              </div>
                              {st.eliminated && <div className="sp-elim-tag"><Skull size={12} /> Out — week {st.eliminatedAtWeek}</div>}
                            </td>
                            {WEEKS.map((w) => {
                              const eliminatedLock = st.eliminated && w > st.eliminatedAtWeek;
                              const timeLocked = effectiveLocked(w);
                              const canEdit = (hostUnlocked || isOwner) && !timeLocked;
                              const vp = getVisiblePick(m, w);
                              const isVs = vsCellKeys.has(`${m.id}-${w}`);
                              return (
                                <td className={`sp-cell ${eliminatedLock ? "locked" : ""} ${isVs && !eliminatedLock ? "vs" : ""}`} key={w}>
                                  {eliminatedLock ? (
                                    <Lock size={14} className="sp-locked-icon" />
                                  ) : (
                                    <div className="sp-cell-inner">
                                      {vp === "hidden" ? (
                                        <div className="sp-hidden-pick" title="Hidden until this team kicks off"><EyeOff size={13} /></div>
                                      ) : vp ? (
                                        <>
                                          <span onClick={canEdit ? () => setPicker({ memberId: m.id, week: w }) : undefined}
                                            style={{ cursor: canEdit ? "pointer" : "default", opacity: vp.result === "loss" ? 0.55 : 1, filter: vp.result === "loss" ? "grayscale(0.4)" : "none" }}>
                                            <TeamChip abbr={vp.team} size="sm" />
                                          </span>
                                          {isVs && <Swords size={11} color="var(--gold)" />}
                                          {hostUnlocked && (
                                            <div className="sp-result-row">
                                              <button className={`sp-result-btn ${vp.result === "win" ? "win-active" : ""}`} onClick={() => setResult(m.id, w, "win")} title="Mark correct"><Check size={12} /></button>
                                              <button className={`sp-result-btn ${vp.result === "loss" ? "loss-active" : ""}`} onClick={() => setResult(m.id, w, "loss")} title="Mark wrong"><X size={12} /></button>
                                            </div>
                                          )}
                                        </>
                                      ) : canEdit ? (
                                        <button className="sp-pick-empty" onClick={() => setPicker({ memberId: m.id, week: w })}>+</button>
                                      ) : (
                                        <span style={{ color: "var(--text-dim)" }}>{timeLocked ? <Lock size={12} /> : "—"}</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {Object.entries(checkMsg).some(([, v]) => v) && (
                <div style={{ marginTop: 10 }}>
                  {WEEKS.filter((w) => checkMsg[w]).map((w) => <div key={w} className={`sp-check-msg ${checkMsg[w].type}`}>Week {w}: {checkMsg[w].text}</div>)}
                </div>
              )}
              <div className="sp-sub" style={{ marginTop: 12 }}>
                Other members' picks stay hidden (eye-off icon) until that week's games start, then reveal automatically for everyone. Your own row is always visible to you.{" "}
                {hostUnlocked && "The clock icon is a manual override — click to force that week locked or unlocked regardless of kickoff time, click again to hand it back to automatic."}{" "}
                <span className="sp-btn-ghost sp-btn sp-btn-sm" style={{ display: "inline-flex", marginLeft: 4 }} onClick={() => openScoreboard(1)}><ExternalLink size={12} /> open scoreboard</span>
              </div>
            </div>

            <div className="sp-panel">
              <div className="sp-panel-head" style={{ cursor: "pointer" }} onClick={() => setVsOpen((v) => !v)}>
                <div className="sp-panel-title sp-display"><Swords size={17} /> Head-to-Head</div>
                <ChevronDown size={16} style={{ transform: vsOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </div>
              {vsOpen && (
                <>
                  <div className="sp-sub" style={{ marginBottom: 12 }}>
                    Flags weeks where two members picked teams that are playing each other — those cells get a gold outline in the grid above.{" "}
                    {hostUnlocked && (
                      <span className="sp-btn-ghost sp-btn sp-btn-sm" style={{ display: "inline-flex", marginLeft: 4 }} onClick={syncSchedule} disabled={syncing}>
                        {syncing ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />} Sync schedule
                      </span>
                    )}
                  </div>
                  {syncMsg && <div className="sp-check-msg info" style={{ marginBottom: 10 }}>{syncMsg}</div>}
                  {Object.keys(matchupsByWeek).length === 0 ? (
                    <div className="sp-empty">{hostUnlocked ? 'Click "Sync schedule" to pull this season\'s matchups from ESPN.' : "The host hasn't synced the schedule yet."}</div>
                  ) : Object.keys(headToHead).length === 0 ? (
                    <div className="sp-empty">No head-to-head picks yet — check back as more picks come in.</div>
                  ) : (
                    WEEKS.filter((w) => headToHead[w]).map((w) => (
                      <div className="sp-vs-week" key={w}>
                        <div className="sp-vs-week-label">Week {w}</div>
                        {headToHead[w].map((match, i) => (
                          <div className="sp-vs-row" key={i}>
                            <span className="sp-vs-name">{match.memberA.name}</span>
                            <TeamChip abbr={match.teamA} size="sm" />
                            <Swords size={13} color="var(--gold)" />
                            <TeamChip abbr={match.teamB} size="sm" />
                            <span className="sp-vs-name">{match.memberB.name}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            <div className="sp-panel">
              <div className="sp-panel-head" style={{ cursor: "pointer" }} onClick={() => setStatsOpen((v) => !v)}>
                <div className="sp-panel-title sp-display"><BarChart3 size={17} /> Pool Stats</div>
                <ChevronDown size={16} style={{ transform: statsOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </div>
              {statsOpen && (
                <div className="sp-stats-grid">
                  <div>
                    <div className="sp-panel-title sp-display" style={{ fontSize: 14, marginBottom: 8, display: "flex", gap: 6 }}><TrendingDown size={15} color="var(--gold)" /> Boldest pickers</div>
                    {boldestPickers.length === 0 ? <div className="sp-empty">Add reference win % below to see this ranking.</div> : boldestPickers.map((r, i) => (
                      <div className="sp-stat-row" key={r.id}><span className="sp-rank">{i + 1}</span><span style={{ flex: 1 }}>{r.name}</span><span className="sp-stat-val">{(r.avg * 100).toFixed(0)}% avg</span></div>
                    ))}
                  </div>
                  <div>
                    <div className="sp-panel-title sp-display" style={{ fontSize: 14, marginBottom: 8, display: "flex", gap: 6 }}><Flame size={15} color="var(--gold)" /> Most picked teams</div>
                    {teamPickCounts.length === 0 ? <div className="sp-empty">No picks visible to you yet.</div> : teamPickCounts.slice(0, 10).map(([abbr, count]) => (
                      <div className="sp-stat-row" key={abbr}><TeamChip abbr={abbr} size="sm" /><div className="sp-bar-track"><div className="sp-bar-fill" style={{ width: `${(count / maxPickCount) * 100}%` }} /></div><span className="sp-stat-val">{count}×</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sp-panel">
              <div className="sp-panel-head" style={{ cursor: "pointer" }} onClick={() => setWinPctOpen((v) => !v)}>
                <div className="sp-panel-title sp-display">Reference Win %</div>
                <ChevronDown size={16} style={{ transform: winPctOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </div>
              {winPctOpen && (
                <div className="sp-pct-grid">
                  {TEAMS.map((t) => (
                    <div className="sp-pct-item" key={t.abbr}>
                      <TeamChip abbr={t.abbr} size="sm" />
                      <input className="sp-pct-input" type="number" min="0" max="100" placeholder="—" disabled={!hostUnlocked}
                        value={typeof teamStats[t.abbr] === "number" ? Math.round(teamStats[t.abbr] * 100) : ""}
                        onChange={(e) => {
                          if (!hostUnlocked) return;
                          const v = e.target.value;
                          if (v === "") { const n = { ...teamStats }; delete n[t.abbr]; pushTeamStats(n); }
                          else setWinPct(t.abbr, Math.max(0, Math.min(100, Number(v))) / 100);
                        }} />
                      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {picker && (hostUnlocked || memberSession === picker.memberId) && (
        <TeamPickerModal picker={picker} members={members} onClose={() => setPicker(null)} onSelect={selectTeam} onClear={clearPick} />
      )}

      {loginOpen && (
        <div className="sp-modal-backdrop" onClick={() => setLoginOpen(false)}>
          <div className="sp-modal sp-modal-narrow" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-head">
              <div className="sp-panel-title sp-display">Host sign-in</div>
              <button className="sp-modal-close" onClick={() => setLoginOpen(false)}><X size={18} /></button>
            </div>
            <div className="sp-modal-body">
              <input className="sp-pin-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              <input className="sp-pin-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitLogin()} />
              {loginError && <div className="sp-pin-error">{loginError}</div>}
              <button className="sp-btn" style={{ width: "100%", justifyContent: "center" }} onClick={submitLogin} disabled={loginBusy}>{loginBusy ? "Signing in…" : "Sign in"}</button>
              <div className="sp-pin-note">There's no public sign-up here — only the one account you created for yourself in the Firebase console can sign in.</div>
            </div>
          </div>
        </div>
      )}

      {teamModalOpen && <TeamLoginModal members={members} onClose={() => setTeamModalOpen(false)} onSubmit={claimOrSignInMember} />}
    </div>
  );
}

function TeamLoginModal({ members, onClose, onSubmit }) {
  const [selected, setSelected] = useState(members[0]?.id || "");
  const [code, setCode] = useState("");
  const [code2, setCode2] = useState("");
  const [error, setError] = useState("");
  const target = members.find((m) => m.id === selected);
  const isNew = target && !target.passcode;

  function submit() {
    setError("");
    if (!selected) return setError("Choose your team first.");
    if (isNew) {
      if (code.trim().length < 4) return setError("Use at least 4 characters.");
      if (code !== code2) return setError("Codes don't match.");
    } else if (!code) {
      return setError("Enter your code.");
    }
    const err = onSubmit(selected, code);
    if (err) setError(err);
  }

  return (
    <div className="sp-modal-backdrop" onClick={onClose}>
      <div className="sp-modal sp-modal-narrow" onClick={(e) => e.stopPropagation()}>
        <div className="sp-modal-head">
          <div className="sp-panel-title sp-display">Team sign-in</div>
          <button className="sp-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="sp-modal-body">
          {members.length === 0 ? (
            <div className="sp-empty">No members yet — ask the host to add your name first.</div>
          ) : (
            <>
              <select className="sp-select" value={selected} onChange={(e) => { setSelected(e.target.value); setError(""); setCode(""); setCode2(""); }}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.passcode ? "" : " (unclaimed)"}</option>
                ))}
              </select>
              {isNew && <div className="sp-sub" style={{ marginBottom: 10 }}>Nobody's claimed this team yet — set a code so it's yours.</div>}
              <input className="sp-pin-input" type="password" placeholder={isNew ? "Create a code" : "Enter your code"} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !isNew && submit()} autoFocus />
              {isNew && <input className="sp-pin-input" type="password" placeholder="Confirm code" value={code2} onChange={(e) => setCode2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />}
              {error && <div className="sp-pin-error">{error}</div>}
              <button className="sp-btn" style={{ width: "100%", justifyContent: "center" }} onClick={submit}>{isNew ? "Set code & sign in" : "Sign in"}</button>
              <div className="sp-pin-note">This code deters casual peeking at your picks — it isn't real security. Don't reuse a password you use elsewhere.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TeamPickerModal({ picker, members, onClose, onSelect, onClear }) {
  const member = members.find((m) => m.id === picker.memberId);
  if (!member) return null;
  const used = new Set(Object.entries(member.picks).filter(([w]) => Number(w) !== picker.week).map(([, p]) => p.team));
  const existing = member.picks[picker.week];
  return (
    <div className="sp-modal-backdrop" onClick={onClose}>
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sp-modal-head">
          <div>
            <div className="sp-panel-title sp-display">{member.name} — Week {picker.week}</div>
            <div className="sp-sub" style={{ marginTop: 2 }}>Grayed-out teams have already been used this season.</div>
          </div>
          <button className="sp-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="sp-modal-body">
          <div className="sp-team-grid">
            {TEAMS.map((t) => {
              const isUsed = used.has(t.abbr);
              const fg = textColorFor(t.primary);
              return (
                <button key={t.abbr} className={`sp-team-btn ${isUsed ? "used" : ""}`} style={{ background: t.primary, borderColor: t.secondary, color: fg }} disabled={isUsed} onClick={() => onSelect(member.id, picker.week, t.abbr)}>
                  {t.abbr}<small>{t.city} {t.name}</small>
                </button>
              );
            })}
          </div>
          {existing && <button className="sp-btn sp-btn-ghost sp-btn-sm" style={{ marginTop: 14 }} onClick={() => onClear(member.id, picker.week)}>Clear this week's pick</button>}
        </div>
      </div>
    </div>
  );
}
