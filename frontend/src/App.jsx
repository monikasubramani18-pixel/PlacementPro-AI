import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

// Backend URL comes from the frontend's .env (VITE_API_URL) so it's not
// hard-coded — set VITE_API_URL=http://127.0.0.1:8000 locally, and to your
// deployed backend URL in production.
const API_BASE = import.meta.env.VITE_API_URL;

// Central fetch wrapper: attaches the JWT (when present) and sets the
// right Content-Type — application/json for normal requests, but leaves
// it unset for FormData (file uploads) so the browser can set the
// multipart/form-data boundary itself.
const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem("placementpro_token");

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, {
    ...options,
    headers,
  });
};


const futuristicStyles = `
  .placementpro-input::placeholder { color: rgb(100 116 139); }
  .placementpro-input:focus {
    outline: none;
    border-color: rgb(34 211 238 / 0.45);
    box-shadow: 0 0 0 3px rgb(34 211 238 / 0.08), 0 0 24px rgb(34 211 238 / 0.08);
  }
`;

function App() {
  const [active, setActive] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [student, setStudent] = useState(null);
  const [token, setToken] = useState(
    () => localStorage.getItem("placementpro_token") || null
  );
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [resumeScore, setResumeScore] = useState(0);
  const [codingScore, setCodingScore] = useState(0);
  const [aptitudeScore, setAptitudeScore] = useState(0);
  const [projectScore, setProjectScore] = useState(0);
  const [interviewScore, setInterviewScore] = useState(0);
  const [readinessScore, setReadinessScore] = useState(0);
  const [aiInsight, setAiInsight] = useState("");
  const [companyPreparation, setCompanyPreparation] = useState(null);
  const [companyPreparationLoading, setCompanyPreparationLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(true);
  const [dailyPlan, setDailyPlan] = useState([]);
  const [aiDailyPlan, setAiDailyPlan] = useState("");
  const [dailyPlanLoading, setDailyPlanLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const skillScores = {
    Resume: resumeScore,
    Coding: codingScore,
    Aptitude: aptitudeScore,
    Projects: projectScore,
    Interview: interviewScore
  };

  const weakestSkill = Object.entries(skillScores).reduce(
    (lowest, current) =>
      current[1] < lowest[1] ? current : lowest
  );

  // On mount: if a token is already stored, restore the session by
  // asking the backend who it belongs to. This is what makes
  // "refresh the page → still logged in" work.
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      if (!token) {
        setLoading(false);
        setAuthChecked(true);
        return;
      }

      try {
        const response = await apiFetch(`${API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const data = await response.json();

        if (cancelled) return;

        setStudent(data);
        setLoading(false);
        setAuthChecked(true);
      } catch (error) {
        if (cancelled) return;

        console.error("Could not restore session:", error);
        localStorage.removeItem("placementpro_token");
        setToken(null);
        setStudent(null);
        setLoading(false);
        setAuthChecked(true);
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAuthSuccess = (data) => {
    const {
      access_token,
      token_type,
      ...profile
    } = data;

    localStorage.setItem("placementpro_token", access_token);
    setToken(access_token);
    setStudent(profile);
    setApiError(null);
    setActive("Dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("placementpro_token");
    setToken(null);
    setStudent(null);
    setActive("Dashboard");
  };

  useEffect(() => {
    const loadResumeScore = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/resume/history/${student.id}`
        );

        const data = await response.json();

        if (response.ok && data.length > 0) {
          setResumeScore(data[0].resume_score);
        } else {
          setResumeScore(0);
        }
      } catch (error) {
        console.error("Could not load resume score:", error);
      }
    };

    loadResumeScore();
  }, [student]);

  useEffect(() => {
    const loadCodingScore = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/coding/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setCodingScore(data.coding_score || 0);
        }
      } catch (error) {
        console.error("Could not load coding score:", error);
      }
    };

    loadCodingScore();
  }, [student]);

  useEffect(() => {
    const loadAptitudeScore = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/aptitude/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setAptitudeScore(data.aptitude_score || 0);
        }
      } catch (error) {
        console.error("Could not load aptitude score:", error);
      }
    };

    loadAptitudeScore();
  }, [student]);

  useEffect(() => {
    const loadProjectScore = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/projects/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setProjectScore(data.project_score || 0);
        }
      } catch (error) {
        console.error("Could not load project score:", error);
      }
    };

    loadProjectScore();
  }, [student]);

  useEffect(() => {
    const loadDashboardProgress = async () => {
      if (!student?.id) return;

      try {
        setProgressLoading(true);

        const response = await apiFetch(
          `${API_BASE}/progress/${student.id}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Failed to load dashboard progress"
          );
        }

        setResumeScore(data.resume_score || 0);
        setCodingScore(data.coding_score || 0);
        setAptitudeScore(data.aptitude_score || 0);
        setProjectScore(data.project_score || 0);
        setInterviewScore(data.interview_score || 0);
        setReadinessScore(data.readiness_score || 0);

      } catch (error) {
        console.error(
          "Could not load dashboard progress:",
          error
        );
      } finally {
        setProgressLoading(false);
      }
    };

    loadDashboardProgress();
  }, [student]);

  useEffect(() => {
    const loadAIInsight = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/students/${student.id}/dashboard-insight`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Could not load AI insight"
          );
        }

        setAiInsight(data.ai_insight || "");
      } catch (error) {
        console.error("AI insight error:", error);
        setAiInsight("");
      }
    };

    loadAIInsight();
  }, [student]);

  useEffect(() => {
    const loadCompanyPreparation = async () => {
      if (!student?.id) return;

      try {
        setCompanyPreparationLoading(true);

        const companiesResponse = await apiFetch(
          `${API_BASE}/companies`
        );

        const companies = await companiesResponse.json();

        if (!companiesResponse.ok || !companies.length) {
          return;
        }

        // Use the first company as the default company
        const company = companies[0];

        const preparationResponse = await apiFetch(
          `${API_BASE}/companies/${company.id}/preparation`
        );

        const preparation = await preparationResponse.json();

        if (!preparationResponse.ok) {
          return;
        }

        const progressResponse = await apiFetch(
          `${API_BASE}/companies/${company.id}/preparation/progress?student_id=${student.id}`
        );

        const progress = await progressResponse.json();

        if (!progressResponse.ok) {
          return;
        }

        const totalSkills = preparation.checklist?.length || 0;
        const completedSkills =
          progress.completed_skills?.length || 0;

        const percentage =
          totalSkills > 0
            ? Math.round((completedSkills / totalSkills) * 100)
            : 0;

        setCompanyPreparation({
          company: preparation.company,
          role: preparation.role,
          completedSkills,
          totalSkills,
          percentage
        });

      } catch (error) {
        console.error(
          "Could not load company preparation:",
          error
        );
      } finally {
        setCompanyPreparationLoading(false);
      }
    };

    loadCompanyPreparation();
  }, [student]);

  const loadDailyPlan = async () => {
    if (!student?.id) return;

    setDailyPlanLoading(true);

    try {
      const response = await apiFetch(
        `${API_BASE}/students/${student.id}/daily-plan`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to load daily plan"
        );
      }

      setDailyPlan(data.plan || []);
      setAiDailyPlan(data.ai_daily_plan || "");
    } catch (error) {
      console.error("Daily plan error:", error);
    } finally {
      setDailyPlanLoading(false);
    }
  };

  useEffect(() => {
    if (student?.id) {
      loadDailyPlan();
    }
  }, [student?.id]);

  const goToPlanArea = (area) => {
    const navigationMap = {
      "Resume": "Resume",
      "Coding & DSA": "Coding",
      "Aptitude": "Aptitude",
      "Projects": "Projects",
      "Interview": "Interview",
    };

    const page = navigationMap[area];

    if (page) {
      setActive(page);
    }
  };

  const loadAnalytics = async () => {
    if (!student?.id) return;

    setAnalyticsLoading(true);

    try {
      const response = await apiFetch(
        `${API_BASE}/students/${student.id}/analytics`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to load analytics"
        );
      }

      setAnalytics(data);
    } catch (error) {
      console.error("Analytics error:", error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (student?.id) {
      loadAnalytics();
    }
  }, [student?.id]);

  const analyticsChartData = analytics
    ? Object.entries(analytics.scores).map(
        ([area, score]) => ({
          area,
          score
        })
      )
    : [];

  const analyticsInsights = analytics
    ? [
        {
          title: "🎯 Readiness",
          message:
            analytics.readiness_score >= 80
              ? "Your overall placement readiness is strong. Continue practicing consistently."
              : analytics.readiness_score >= 60
              ? "Your placement preparation is progressing well. Focus on your weaker areas."
              : "Your placement readiness needs improvement. Build a consistent preparation routine."
        },
        {
          title: "💪 Strongest Area",
          message: `Your strongest preparation area is ${analytics.strongest_area.area} with a score of ${analytics.strongest_area.score}%.`
        },
        {
          title: "📌 Focus Area",
          message: `Your current focus area should be ${analytics.weakest_area.area}. Its score is ${analytics.weakest_area.score}%.`
        },
        {
          title: "📈 Improvement Strategy",
          message:
            analytics.weakest_area.score < 60
              ? `Spend additional practice time on ${analytics.weakest_area.area} and gradually improve the score above 60%.`
              : `Maintain your current performance while working toward a score above 80% in ${analytics.weakest_area.area}.`
        }
      ]
    : [];

  const menu = [
    { name: "Dashboard", icon: "📊" },
    { name: "Profile", icon: "👤" },
    { name: "Resume", icon: "📄" },
    { name: "Coding", icon: "💻" },
    { name: "Aptitude", icon: "🧠" },
    { name: "Interview", icon: "🎤" },
    { name: "Companies", icon: "🏢" },
    { name: "Projects", icon: "🚀" },
    { name: "Progress", icon: "📈" },
    { name: "Analytics", icon: "📊" },
    { name: "Career Roadmap", icon: "🗺️" },
    { name: "Project Suggestions", icon: "💡" },
    { name: "AI Assistant", icon: "💬" },
  ];

  // Checking localStorage for a session token before deciding what to render.
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#05070d] flex items-center justify-center">
        <p className="text-slate-400">Loading PlacementPro...</p>
      </div>
    );
  }

  // No valid session — show the login/register screen instead of the app.
  if (!token || !student) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#05070d] text-white flex overflow-hidden">
      <style>{futuristicStyles}</style>
      {/* Ambient futuristic background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-[35%] -left-52 w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 w-72
        bg-[#080b13]/95 backdrop-blur-xl border-r border-white/10
        flex flex-col p-5 transform transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.28)]">
              <span className="text-white text-xl font-black">P</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">
                Placement<span className="text-cyan-400">Pro</span>
              </h1>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                AI Placement Coach
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1">
          {menu.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setActive(item.name);
                if (item.name === "Profile") setShowProfile(true);
                else setShowProfile(false);
                setSidebarOpen(false);
              }}
              className={`group w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                active === item.name
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/10 text-cyan-300 border border-cyan-400/20 shadow-[0_0_22px_rgba(34,211,238,0.08)]"
                  : "text-slate-400 hover:text-white hover:bg-[#0b1018]/5 border border-transparent"
              }`}
            >
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${
                  active === item.name
                    ? "bg-cyan-400/10"
                    : "bg-[#0b1018]/[0.03] group-hover:bg-[#0b1018]/10"
                }`}
              >
                {item.icon}
              </span>
              <span>{item.name}</span>
              {active === item.name && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.9)]" />
              )}
            </button>
          ))}
        </nav>

        <div className="mt-5 pt-5 border-t border-white/10">
          <div className="rounded-2xl bg-[#0b1018]/[0.03] border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center font-black">
                {student?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{student?.name || "Student"}</p>
                <p className="text-xs text-slate-400 truncate">
                  {student?.target_role || "Software Developer"}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="mt-4 w-full text-left text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              ⏻ Sign out
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Main area */}
      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto">
        <header className="sticky top-0 z-30 bg-[#05070d]/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between max-w-[1500px] mx-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden w-10 h-10 rounded-xl bg-[#0b1018]/5 border border-white/10 flex items-center justify-center text-slate-300"
              >
                ☰
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-400/80">
                  AI Placement Platform
                </p>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {active === "Dashboard" ? "Your placement command center" : active}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold">{student?.name || "Student"}</p>
                <p className="text-[11px] text-slate-400">
                  {student?.target_role || "Software Developer"}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full border border-cyan-400/30 bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center font-bold text-cyan-300">
                {student?.name?.charAt(0)?.toUpperCase() || "S"}
              </div>
            </div>
          </div>
        </header>

        {active === "Profile" ? (
          <ProfilePage student={student} setStudent={setStudent} />
        ) : active === "Resume" ? (
          <ResumePage student={student} />
        ) : active === "Coding" ? (
          <CodingPage student={student} />
        ) : active === "Aptitude" ? (
          <AptitudePage student={student} />
        ) : active === "Interview" ? (
          <InterviewPage student={student} />
        ) : active === "Companies" ? (
          <CompaniesPage student={student} />
        ) : active === "Projects" ? (
          <ProjectsPage student={student} />
        ) : active === "Progress" ? (
          <ProgressPage student={student} />
        ) : active === "Analytics" ? (
          <section className="p-4 sm:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-400 font-semibold">
                  Performance Intelligence
                </p>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-2">
                  Placement Analytics
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  Track preparation performance and identify your next focus area.
                </p>
              </div>

              {analyticsLoading ? (
                <div className="rounded-3xl bg-[#0b1018]/[0.03] border border-white/10 p-12 text-center text-slate-400">
                  Loading analytics...
                </div>
              ) : analytics ? (
                <>
                  <div className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-white/[0.03] to-purple-500/10 p-6 sm:p-8">
                    <div className="absolute -right-20 -top-20 w-56 h-56 rounded-full border border-cyan-400/10" />
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border border-purple-400/10" />
                    <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                      <div>
                        <p className="text-sm text-slate-400">Placement Readiness</p>
                        <div className="mt-2 flex items-end gap-2">
                          <span className="text-6xl font-black bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
                            {analytics.readiness_score}%
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">
                          Average score: <span className="text-white font-semibold">{analytics.average_score}%</span>
                        </p>
                      </div>
                      <div className="w-full sm:w-64">
                        <div className="flex justify-between text-xs text-slate-400 mb-2">
                          <span>Readiness</span>
                          <span>{analytics.readiness_score}/100</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#0b1018]/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
                            style={{ width: `${analytics.readiness_score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {Object.entries(analytics.scores).map(([area, score]) => (
                      <div
                        key={area}
                        className="rounded-2xl border border-white/10 bg-[#0b1018]/[0.03] p-5 hover:bg-[#0b1018]/[0.05] transition"
                      >
                        <p className="text-xs uppercase tracking-wider text-slate-400">{area}</p>
                        <p className="mt-3 text-3xl font-black">{score}%</p>
                        <div className="mt-4 h-1.5 rounded-full bg-[#0b1018]/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-[#0b1018]/[0.03] p-5 sm:p-6">
                    <h2 className="text-xl font-bold">Performance Overview</h2>
                    <p className="mt-1 text-sm text-slate-400">Compare your preparation areas.</p>
                    <div className="h-80 w-full mt-5">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="area" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: "#64748b", fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              background: "#0b1020",
                              border: "1px solid rgba(34,211,238,0.2)",
                              borderRadius: "12px",
                              color: "#fff",
                            }}
                            formatter={(value) => [`${value}%`, "Score"]}
                          />
                          <Bar dataKey="score" fill="#22d3ee" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {analyticsInsights.map((insight, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-white/10 bg-[#0b1018]/[0.03] p-5"
                      >
                        <h3 className="font-bold text-white">{insight.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{insight.message}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-[#0b1018]/[0.03] p-10 text-center text-slate-400">
                  Analytics data is not available.
                </div>
              )}
            </div>
          </section>
        ) : active === "Career Roadmap" ? (
          <CareerRoadmapPage student={student} />
        ) : active === "Project Suggestions" ? (
          <ProjectSuggestionsPage student={student} />
        ) : active === "AI Assistant" ? (
          <PlacementChatPage student={student} />
        ) : (
          /* Dashboard */
          <section className="relative p-4 sm:p-6 lg:p-8">
            <div className="max-w-[1500px] mx-auto">
              {loading ? (
                <div className="min-h-[70vh] flex items-center justify-center text-slate-400">
                  Loading your placement command center...
                </div>
              ) : (
                <>
                  {apiError && (
                    <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-300">
                      Couldn't load student data: {apiError}
                    </div>
                  )}

                  {/* Hero */}
                  <div className="relative min-h-[430px] overflow-hidden rounded-[32px] border border-cyan-400/20 bg-gradient-to-br from-[#07131c] via-[#080b15] to-[#120a1f] p-6 sm:p-10 lg:p-12 shadow-[0_0_60px_rgba(34,211,238,0.06)]">
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full border border-cyan-400/20" />
                      <div className="absolute -right-4 top-10 w-[320px] h-[320px] rounded-full border border-purple-500/30 rotate-12" />
                      <div className="absolute right-12 top-28 w-[210px] h-[210px] rounded-full border border-cyan-300/20 -rotate-12" />
                      <div className="absolute right-28 top-40 w-28 h-28 rounded-full bg-gradient-to-br from-cyan-300/20 to-purple-500/10 blur-xl" />
                      <div className="absolute right-36 top-48 w-16 h-16 rounded-full bg-slate-900 border border-white/10 shadow-[0_0_45px_rgba(34,211,238,0.2)]" />
                    </div>

                    <div className="relative z-10 max-w-2xl">
                      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-4 py-2 text-xs font-semibold text-cyan-300">
                        <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
                        AI-POWERED PLACEMENT PREPARATION
                      </div>

                      <h1 className="mt-7 text-4xl sm:text-5xl lg:text-7xl font-black leading-[0.95] tracking-[-0.04em]">
                        Get Placement
                        <br />
                        <span className="text-white">Ready with </span>
                        <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                          AI
                        </span>
                      </h1>

                      <p className="mt-6 max-w-xl text-sm sm:text-base leading-7 text-slate-400">
                        Your personalized command center for resume analysis, coding,
                        aptitude, projects, interviews, and company preparation.
                      </p>

                      <div className="mt-7 flex flex-wrap gap-3">
                        <button
                          onClick={() => setActive(weakestSkill[0])}
                          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black text-sm shadow-[0_0_30px_rgba(34,211,238,0.2)] hover:scale-[1.02] transition"
                        >
                          Continue Preparation →
                        </button>
                        <button
                          onClick={() => setActive("Analytics")}
                          className="px-6 py-3 rounded-xl border border-white/15 bg-[#0b1018]/5 text-white font-semibold text-sm hover:bg-[#0b1018]/10 transition"
                        >
                          View Analytics
                        </button>
                      </div>
                    </div>
                  </div>

                  {aiInsight && (
                    <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-400/[0.06] to-purple-500/[0.06] p-6 shadow-[0_0_35px_rgba(34,211,238,0.08)]">

                      <div className="flex items-start gap-4">

                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-xl">
                          🧠
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-white">
                              PlacementPro AI Insight
                            </h3>

                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyan-300">
                              AI
                            </span>
                          </div>

                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">
                            {aiInsight}
                          </p>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* Readiness strip */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
                    <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0b1018]/[0.03] p-5 sm:p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Placement Readiness</p>
                          <p className="mt-2 text-4xl font-black">{readinessScore}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Current focus</p>
                          <p className="mt-1 font-bold text-cyan-300">{weakestSkill[0]}</p>
                        </div>
                      </div>
                      <div className="mt-5 h-2 rounded-full bg-[#0b1018]/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 transition-all duration-700"
                          style={{ width: `${readinessScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-purple-400/15 bg-purple-500/[0.05] p-5 sm:p-6">
                      <p className="text-xs uppercase tracking-[0.18em] text-purple-300/70">Next Goal</p>
                      <p className="mt-2 font-bold text-white">Strengthen {weakestSkill[0]}</p>
                      <button
                        onClick={() => setActive(weakestSkill[0])}
                        className="mt-4 text-sm font-bold text-cyan-300 hover:text-cyan-200"
                      >
                        Start now →
                      </button>
                    </div>
                  </div>

                  {/* Score cards */}
                  <div className="mt-5 grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                    {[
                      ["Resume", resumeScore, "📄"],
                      ["Coding", codingScore, "💻"],
                      ["Aptitude", aptitudeScore, "🧠"],
                      ["Projects", projectScore, "🚀"],
                      ["Interview", interviewScore, "🎤"],
                    ].map(([name, score, icon]) => (
                      <button
                        key={name}
                        onClick={() => setActive(name)}
                        className="text-left rounded-2xl border border-white/10 bg-[#0b1018]/[0.03] p-4 sm:p-5 hover:bg-[#0b1018]/[0.06] hover:border-cyan-400/20 transition group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg">{icon}</span>
                          <span className="text-xs text-slate-300 group-hover:text-cyan-400">→</span>
                        </div>
                        <p className="mt-4 text-xs uppercase tracking-wider text-slate-400">{name}</p>
                        <p className="mt-1 text-2xl sm:text-3xl font-black">{score}%</p>
                        <div className="mt-3 h-1 rounded-full bg-[#0b1018]/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Plan + preparation */}
                  <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 mt-5">
                    <div className="xl:col-span-3 rounded-3xl border border-white/10 bg-[#0b1018]/[0.03] p-5 sm:p-6">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-cyan-400">Daily AI Plan</p>
                          <h2 className="text-xl font-bold mt-1">Today's Placement Plan</h2>
                        </div>
                        <span className="text-xs text-slate-400">Personalized</span>
                      </div>

                      {dailyPlanLoading ? (
                        <p className="text-sm text-slate-400">Creating your plan...</p>
                      ) : dailyPlan.length === 0 ? (
                        <p className="text-sm text-slate-400">No placement plan available yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {dailyPlan.map((item, index) => (
                            <div
                              key={index}
                              className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-cyan-400/20 transition"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-cyan-300">0{index + 1}</span>
                                    <h3 className="font-bold">{item.area}</h3>
                                  </div>
                                  <p className="mt-2 text-sm text-slate-400">{item.task}</p>
                                </div>
                                <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-400">
                                  {item.priority}
                                </span>
                              </div>
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs text-slate-300">Current score: {item.score}%</span>
                                <button
                                  onClick={() => goToPlanArea(item.area)}
                                  className="text-xs font-bold text-cyan-300 hover:text-cyan-200"
                                >
                                  Start Practice →
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {aiDailyPlan && (
                        <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-white/[0.03] p-6">
                          <div className="flex items-center gap-3 mb-5">
                            <div className="h-11 w-11 rounded-xl bg-cyan-400/10 flex items-center justify-center">
                              📅
                            </div>

                            <div>
                              <h3 className="text-lg font-semibold text-white">
                                AI Daily Placement Plan
                              </h3>
                              <p className="text-sm text-slate-400">
                                Personalized tasks based on your current progress
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                            <p className="whitespace-pre-line text-slate-200 leading-7">
                              {aiDailyPlan}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="xl:col-span-2 rounded-3xl border border-white/10 bg-[#0b1018]/[0.03] p-5 sm:p-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-purple-300">Company Readiness</p>
                        <h2 className="text-xl font-bold mt-1">Company Preparation</h2>
                      </div>

                      {companyPreparationLoading ? (
                        <p className="text-sm text-slate-400 mt-6">Loading preparation progress...</p>
                      ) : companyPreparation ? (
                        <>
                          <div className="mt-7 flex items-end justify-between">
                            <div>
                              <p className="text-sm text-slate-400">{companyPreparation.company}</p>
                              <p className="text-xs text-slate-300 mt-1">{companyPreparation.role}</p>
                            </div>
                            <span className="text-4xl font-black text-cyan-300">{companyPreparation.percentage}%</span>
                          </div>
                          <div className="mt-5 h-2 rounded-full bg-[#0b1018]/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400"
                              style={{ width: `${companyPreparation.percentage}%` }}
                            />
                          </div>
                          <p className="mt-3 text-xs text-slate-400">
                            {companyPreparation.completedSkills} / {companyPreparation.totalSkills} skills completed
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400 mt-6">Start preparing for your target companies.</p>
                      )}

                      <button
                        onClick={() => setActive("Companies")}
                        className="mt-7 w-full rounded-xl border border-white/10 bg-[#0b1018]/5 py-3 text-sm font-bold text-white hover:bg-[#0b1018]/10 transition"
                      >
                        Explore Companies →
                      </button>
                    </div>
                  </div>

                  {/* Skill snapshot */}
                  <div className="mt-5 rounded-3xl border border-white/10 bg-[#0b1018]/[0.03] p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Skill Snapshot</p>
                        <h2 className="text-xl font-bold mt-1">Build the skills companies need</h2>
                      </div>
                      <button
                        onClick={() => setActive("Progress")}
                        className="text-sm font-bold text-cyan-300 hover:text-cyan-200"
                      >
                        View full progress →
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                      {[
                        ["Python", 80],
                        ["SQL", 62],
                        ["DSA", 58],
                        ["DBMS", 70],
                        ["Communication", 65],
                      ].map(([name, value]) => (
                        <div key={name}>
                          <div className="flex justify-between text-xs mb-2">
                            <span className="text-slate-400">{name}</span>
                            <span className="font-bold text-white">{value}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#0b1018]/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500"
                              style={{ width: `${value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}


/* Auth Page (Login / Register) */
function AuthPage({ onAuthSuccess }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    degree: "",
    branch: "",
    cgpa: "",
    target_role: "",
  });

  const handleLoginChange = (e) => {
    setLoginForm({
      ...loginForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegisterChange = (e) => {
    setRegisterForm({
      ...registerForm,
      [e.target.name]: e.target.value,
    });
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await apiFetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Invalid email or password.");
        return;
      }

      onAuthSuccess(data);
    } catch (err) {
      console.error(err);
      setError("Could not connect to backend.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await apiFetch(`${API_BASE}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...registerForm,
          cgpa: Number(registerForm.cgpa) || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Could not create account.");
        return;
      }

      onAuthSuccess(data);
    } catch (err) {
      console.error(err);
      setError("Could not connect to backend.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        <div className="hidden lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-4 py-2 text-xs font-semibold text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
            AI-POWERED PLACEMENT PLATFORM
          </div>

          <h1 className="mt-7 text-6xl font-black leading-[0.95] tracking-[-0.04em]">
            Build skills.
            <br />
            <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              Get ready.
            </span>
            <br />
            Get placed.
          </h1>

          <p className="mt-6 max-w-lg text-slate-400 leading-7">
            A personalized preparation dashboard for coding, aptitude, resume,
            projects, interviews and company readiness.
          </p>

          <div className="mt-8 flex gap-6 text-sm text-slate-400">
            <span>01 · Practice</span>
            <span>02 · Analyze</span>
            <span>03 · Improve</span>
          </div>
        </div>

        <div className="relative rounded-[28px] border border-white/10 bg-[#0b1018]/[0.04] backdrop-blur-xl p-6 sm:p-8 shadow-[0_0_60px_rgba(34,211,238,0.08)]">
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full border border-cyan-400/10 pointer-events-none" />

          <div className="text-center mb-7">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-black text-xl shadow-[0_0_25px_rgba(34,211,238,0.2)]">
              P
            </div>
            <h1 className="text-2xl font-black mt-4">
              Placement<span className="text-cyan-400">Pro</span>
            </h1>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400 mt-1">
              AI Placement Coach
            </p>
          </div>

          <div className="flex mb-6 rounded-xl bg-black/20 border border-white/10 p-1">
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                mode === "login"
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Login
            </button>

            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                mode === "register"
                  ? "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-400/20 text-red-300 p-3 rounded-xl text-sm mb-4">
              {error}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={loginForm.email}
                  onChange={handleLoginChange}
                  required
                  className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10 placeholder:text-slate-200"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  required
                  className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black disabled:opacity-50 hover:scale-[1.01] transition"
              >
                {submitting ? "Logging in..." : "Enter PlacementPro →"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  value={registerForm.name}
                  onChange={handleRegisterChange}
                  required
                  className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-cyan-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={registerForm.email}
                  onChange={handleRegisterChange}
                  required
                  className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-cyan-400/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Password</label>
                <input
                  type="password"
                  name="password"
                  value={registerForm.password}
                  onChange={handleRegisterChange}
                  required
                  minLength={6}
                  className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-cyan-400/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Degree</label>
                  <input
                    type="text"
                    name="degree"
                    value={registerForm.degree}
                    onChange={handleRegisterChange}
                    required
                    className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-cyan-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Branch</label>
                  <input
                    type="text"
                    name="branch"
                    value={registerForm.branch}
                    onChange={handleRegisterChange}
                    required
                    className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-cyan-400/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">CGPA</label>
                  <input
                    type="number"
                    step="0.01"
                    name="cgpa"
                    value={registerForm.cgpa}
                    onChange={handleRegisterChange}
                    required
                    className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-cyan-400/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Target Role</label>
                  <input
                    type="text"
                    name="target_role"
                    value={registerForm.target_role}
                    onChange={handleRegisterChange}
                    required
                    className="w-full bg-black/20 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-cyan-400/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black disabled:opacity-50 hover:scale-[1.01] transition"
              >
                {submitting ? "Creating account..." : "Create My Account →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}


/* Resume Analyzer Page */
function ResumePage({ student }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [aiResumeAnalysis, setAiResumeAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/resume/history/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setHistory(data);
        }
      } catch (error) {
        console.error("Could not load resume history:", error);
      }
    };

    loadHistory();
  }, [student]);

  const getAIRecommendations = async (file) => {
    if (!student?.id) return;

    setAiLoading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("target_role", student.target_role || "Software Developer");
      formData.append("student_id", student.id);

      const response = await apiFetch(
        `${API_BASE}/resume/recommendations`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to get recommendations");
      }

      setAiRecommendations(data);
    } catch (error) {
      console.error("AI recommendation error:", error);
      alert(error.message);
    } finally {
      setAiLoading(false);
    }
  };

  const analyzeResume = async () => {
    if (!file) {
      alert("Please select your resume first.");
      return;
    }

    setLoading(true);
    setResult(null);

    const formData = new FormData();

    formData.append("file", file);

    formData.append(
      "target_role",
      student?.target_role || "Software Developer"
    );

    formData.append("student_id", student?.id);

    try {
      const response = await apiFetch(
        `${API_BASE}/resume/analyze`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Resume analysis failed.");
        return;
      }

      setResult(data);
      setAiResumeAnalysis(data.ai_resume_analysis || "");

      await getAIRecommendations(file);

      const historyResponse = await apiFetch(
        `${API_BASE}/resume/history/${student.id}`
      );

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setHistory(historyData);
      }
    } catch (error) {
      console.error(error);
      alert("Could not connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  const scoreData = result?.score_breakdown || {};

  const scoreItems = [
    {
      name: "Skills",
      score: scoreData.skills || 0,
      max: 25,
      icon: "🛠️",
    },
    {
      name: "Education",
      score: scoreData.education || 0,
      max: 15,
      icon: "🎓",
    },
    {
      name: "Projects",
      score: scoreData.projects || 0,
      max: 20,
      icon: "💻",
    },
    {
      name: "Experience",
      score: scoreData.experience || 0,
      max: 15,
      icon: "💼",
    },
    {
      name: "Certifications",
      score: scoreData.certifications || 0,
      max: 10,
      icon: "📜",
    },
    {
      name: "Completeness",
      score: scoreData.completeness || 0,
      max: 15,
      icon: "📄",
    },
  ];

  return (
    <section className="p-4 sm:p-6">

      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            Resume Analyzer 📄
          </h2>

          <p className="text-slate-400 mt-1">
            Upload your resume and get an AI-powered placement analysis.
          </p>
        </div>


        {/* Upload Card */}
        <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6 mb-6">

          <h3 className="text-lg font-bold mb-2">
            Upload Your Resume
          </h3>

          <p className="text-sm text-slate-400 mb-5">
            Supported formats: PDF and DOCX
          </p>

          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => {
              const selected = e.target.files[0];

              if (selected && selected.size > 5 * 1024 * 1024) {
                alert("File size must be less than 5 MB.");
                e.target.value = "";
                setFile(null);
                return;
              }

              setFile(selected);
              setResult(null);
            }}
            className="block w-full border border-white/10 rounded-lg p-3"
          />

          {file && (
            <p className="text-sm text-green-600 mt-3">
              Selected: {file.name}
            </p>
          )}

          <button
            onClick={analyzeResume}
            disabled={loading}
            className="mt-5 bg-cyan-400 hover:bg-cyan-300 disabled:bg-blue-300 text-white px-6 py-3 rounded-lg font-semibold"
          >
            {loading ? "Analyzing..." : "Analyze Resume"}
          </button>

        </div>


        {/* Results */}
        {result && (
          <div className="space-y-6">

            {/* Resume Score */}
            <div className="bg-[#0b1018] rounded-2xl border border-white/10 shadow-sm p-6">

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">
                    Resume Score
                  </p>

                  <h2 className="text-4xl font-bold text-white mt-1">
                    {result.resume_score ?? 0}%
                  </h2>

                  <p className="font-semibold mt-2">
                    {result.resume_score >= 80
                      ? "Excellent Resume! 🎉"
                      : result.resume_score >= 60
                      ? "Good Resume 👍"
                      : result.resume_score >= 40
                      ? "Needs Improvement ⚠️"
                      : "Resume Needs Major Improvement ❗"}
                  </p>
                </div>

                <div className="w-20 h-20 rounded-full border-8 border-cyan-400/20 flex items-center justify-center flex-shrink-0">
                  <span className="font-bold text-cyan-300">
                    {result.resume_score ?? 0}
                  </span>
                </div>
              </div>

              <div className="w-full bg-[#0b1018]/10 rounded-full h-3 mt-5">
                <div
                  className="bg-cyan-400 h-3 rounded-full transition-all"
                  style={{
                    width: `${Math.min(result.resume_score ?? 0, 100)}%`,
                  }}
                />
              </div>

              <p className="text-sm text-slate-400 mt-4">
                Your score is calculated using skills, education,
                projects, experience, certifications and resume
                completeness.
              </p>

            </div>


            {/* Score Breakdown */}
            <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">

              <div className="mb-5">

                <h3 className="text-lg font-bold">
                  📊 Score Breakdown
                </h3>

                <p className="text-sm text-slate-400 mt-1">
                  See how each part of your resume contributes to the score.
                </p>

              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {scoreItems.map((item) => {

                  const percentage = Math.round(
                    (item.score / item.max) * 100
                  );

                  return (
                    <div
                      key={item.name}
                      className="bg-[#080d15] text-white border-white/10 rounded-xl p-4"
                    >

                      <div className="flex justify-between items-center mb-2">

                        <div className="flex items-center gap-2">

                          <span className="text-xl">
                            {item.icon}
                          </span>

                          <span className="font-semibold">
                            {item.name}
                          </span>

                        </div>

                        <span className="font-bold text-cyan-300">
                          {item.score}/{item.max}
                        </span>

                      </div>


                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">

                        <div
                          className="h-3 bg-cyan-400 rounded-full transition-all duration-700"
                          style={{
                            width: `${percentage}%`,
                          }}
                        ></div>

                      </div>


                      <p className="text-xs text-slate-400 mt-2">
                        {percentage}% of available points
                      </p>

                    </div>
                  );

                })}

              </div>

            </div>


            {/* Detected Skills + Skills to Improve */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Detected Skills */}
              <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">
                <h3 className="text-lg font-bold text-white">
                  Detected Skills
                </h3>

                <p className="text-sm text-slate-400 mt-1 mb-4">
                  Skills identified from your resume
                </p>

                <div className="flex flex-wrap gap-2">
                  {(result.detected_skills || []).length > 0 ? (
                    result.detected_skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium"
                      >
                        ✓ {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">
                      No skills detected.
                    </p>
                  )}
                </div>
              </div>

              {/* Skills to Improve */}
              <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">
                <h3 className="text-lg font-bold text-white">
                  Skills to Improve
                </h3>

                <p className="text-sm text-slate-400 mt-1 mb-4">
                  Skills that could strengthen your resume
                </p>

                <div className="flex flex-wrap gap-2">
                  {(result.missing_skills || []).length > 0 ? (
                    result.missing_skills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-xs font-medium"
                      >
                        + {skill}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-green-600 font-medium">
                      ✓ No major skill gaps detected.
                    </p>
                  )}
                </div>
              </div>

            </div>


            {/* Strengths */}
            <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                Resume Strengths
              </h3>

              {(result.strengths || []).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.strengths.map((strength, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-xl bg-green-50"
                    >
                      <span className="text-green-600 font-bold">
                        ✓
                      </span>

                      <p className="text-sm text-green-800">
                        {strength}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No strengths available.
                </p>
              )}
            </div>


            {/* Suggestions */}
            <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">

              <h3 className="text-lg font-bold mb-4">
                💡 Improvement Suggestions
              </h3>

              {result.suggestions?.length > 0 ? (

                <div className="space-y-3">

                  {result.suggestions.map((suggestion, index) => (

                    <div
                      key={index}
                      className="bg-blue-50 rounded-lg p-4 text-slate-200"
                    >

                      <span className="font-semibold">
                        {index + 1}.
                      </span>{" "}

                      {suggestion}

                    </div>

                  ))}

                </div>

              ) : (

                <p className="text-green-600">
                  Your resume looks good!
                </p>

              )}

            </div>

            {history.length > 0 && (
              <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">
                <h3 className="text-lg font-bold mb-2">
                  📈 Resume Analysis History
                </h3>

                <p className="text-sm text-slate-400 mb-5">
                  Track your previous resume scores and improvement.
                </p>

                <div className="space-y-3">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border rounded-xl p-4"
                    >
                      <div>
                        <p className="font-semibold">
                          {item.filename}
                        </p>

                        <p className="text-sm text-slate-400">
                          Target Role: {item.target_role}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-2xl font-bold text-cyan-300">
                          {item.resume_score}/100
                        </p>

                        <p className="text-xs text-slate-400">
                          Resume Score
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {aiLoading && (
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
            <p className="font-semibold text-blue-700">
              🤖 AI is analyzing your resume...
            </p>
            <p className="mt-1 text-sm text-cyan-300">
              Checking your skills and placement improvement areas.
            </p>
          </div>
        )}

        {aiRecommendations && !aiLoading && (
          <div className="mt-6 bg-[#0b1018] rounded-2xl border border-white/10 shadow-sm p-6">

            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  AI Resume Recommendations
                </h3>

                <p className="text-sm text-slate-400 mt-1">
                  Suggestions to improve your resume for{" "}
                  {aiRecommendations.target_role || "your target role"}.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-semibold">
                AI Insights
              </span>
            </div>

            <div className="space-y-3">

              {(aiRecommendations.recommendations || []).map(
                (recommendation, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-xl bg-[#0b1018]/[0.03] border border-gray-100"
                  >
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-purple-600 font-bold">
                          {index + 1}
                        </span>
                      </div>

                      <p className="text-sm text-slate-200">
                        {typeof recommendation === "string"
                          ? recommendation
                          : recommendation.description ||
                            recommendation.message ||
                            recommendation.recommendation ||
                            "Consider improving this area."}
                      </p>
                    </div>
                  </div>
                )
              )}

            </div>
          </div>
        )}

        {aiResumeAnalysis && (
          <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-white/[0.03] p-6 shadow-[0_0_30px_rgba(34,211,238,0.06)]">

            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-cyan-400/10 flex items-center justify-center">
                🤖
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">
                  Real AI Resume Analysis
                </h3>

                <p className="text-sm text-slate-400">
                  Personalized feedback for your target role
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-black/20 border border-white/10 p-5">
              <p className="whitespace-pre-line text-slate-200 leading-7">
                {aiResumeAnalysis}
              </p>
            </div>

          </div>
        )}

      </div>

    </section>
  );
}

/* Coding Page */
function CodingPage({ student }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [codingScore, setCodingScore] = useState(0);
  const [solved, setSolved] = useState(0);
  const [stats, setStats] = useState({
    total_questions: 0,
    attempted: 0,
    correct: 0,
    accuracy: 0,
    coding_score: 0
  });
  const [loading, setLoading] = useState(true);
  const [attemptedQuestionIds, setAttemptedQuestionIds] = useState([]);
  const [codingResults, setCodingResults] = useState({});

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await apiFetch(
          `${API_BASE}/coding/questions`
        );

        const data = await response.json();

        if (response.ok) {
          setQuestions(data);
        }
      } catch (error) {
        console.error("Could not load coding questions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  useEffect(() => {
    const loadProgress = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/coding/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setCodingScore(data.coding_score || 0);
          setSolved(data.problems_solved || 0);
        }
      } catch (error) {
        console.error("Could not load coding progress:", error);
      }
    };

    loadProgress();
  }, [student]);

  useEffect(() => {
    const loadStats = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/coding/stats/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setStats(data);
        }
      } catch (error) {
        console.error("Could not load coding statistics:", error);
      }
    };

    loadStats();
  }, [student]);

  useEffect(() => {
    const loadAttempted = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/coding/attempted/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setAttemptedQuestionIds(data.attempted_question_ids || []);
        }
      } catch (error) {
        console.error("Could not load attempted questions:", error);
      }
    };

    loadAttempted();
  }, [student]);

  useEffect(() => {
    const loadResults = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/coding/results/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setCodingResults(data);
        }
      } catch (error) {
        console.error("Could not load coding results:", error);
      }
    };

    loadResults();
  }, [student]);

  const submitAnswer = async () => {
    if (!selectedAnswer) {
      alert("Please select an answer.");
      return;
    }

    if (!student?.id) {
      alert("Student profile not found.");
      return;
    }

    const question = questions[currentIndex];

    try {
      const response = await apiFetch(
        `${API_BASE}/coding/${student.id}/submit?question_id=${question.id}&answer=${encodeURIComponent(selectedAnswer)}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Could not submit answer.");
        return;
      }

      setResult(data);
      setCodingScore(data.coding_score);
      setSolved(data.problems_solved);

      setAttemptedQuestionIds((prev) =>
        prev.includes(question.id) ? prev : [...prev, question.id]
      );

      setCodingResults((prev) => ({
        ...prev,
        [String(question.id)]: data.correct
      }));

      const statsResponse = await apiFetch(
        `${API_BASE}/coding/stats/${student.id}`
      );

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error(error);
      alert("Could not connect to backend.");
    }
  };

  const goToQuestion = (index) => {
    setCurrentIndex(index);
    setSelectedAnswer("");

    const targetQuestion = questions[index];

    if (
      targetQuestion &&
      codingResults[String(targetQuestion.id)] !== undefined
    ) {
      setResult({
        correct: codingResults[String(targetQuestion.id)]
      });
    } else {
      setResult(null);
    }
  };

  if (loading) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-400">
            Loading coding questions...
          </p>
        </div>
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">
            <h2 className="text-xl font-bold">
              No coding questions available.
            </h2>
          </div>
        </div>
      </section>
    );
  }

  const question = questions[currentIndex];

  const isCodingTestCompleted =
    stats.total_questions > 0 &&
    stats.attempted === stats.total_questions;

  const getCodingPerformance = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Average";
    return "Needs Improvement";
  };

  return (
    <section className="p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            💻 Coding Practice
          </h2>

          <p className="text-slate-400 mt-1">
            Practice coding and improve your placement readiness.
          </p>
        </div>

        {isCodingTestCompleted ? (
          <div className="inline-flex items-center px-4 py-2 mb-6 rounded-full bg-green-100 text-green-700 font-semibold">
            ✅ Coding Test Completed
          </div>
        ) : (
          <div className="inline-flex items-center px-4 py-2 mb-6 rounded-full bg-cyan-400/10 text-blue-700 font-semibold">
            📝 Test In Progress
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">

          <div className="bg-[#0b1018] rounded-xl border p-5">
            <p className="text-sm text-slate-400">
              Total Questions
            </p>

            <p className="text-3xl font-bold text-purple-600 mt-1">
              {stats.total_questions}
            </p>
          </div>

          <div className="bg-[#0b1018] rounded-xl border p-5">
            <p className="text-sm text-slate-400">
              Attempted
            </p>

            <p className="text-3xl font-bold text-cyan-300 mt-1">
              {stats.attempted}
            </p>
          </div>

          <div className="bg-[#0b1018] rounded-xl border p-5">
            <p className="text-sm text-slate-400">
              Correct
            </p>

            <p className="text-3xl font-bold text-green-600 mt-1">
              {stats.correct}
            </p>
          </div>

          <div className="bg-[#0b1018] rounded-xl border p-5">
            <p className="text-sm text-slate-400">
              Accuracy
            </p>

            <p className="text-3xl font-bold text-orange-600 mt-1">
              {stats.accuracy}%
            </p>
          </div>

          <div className="bg-[#0b1018] rounded-xl border p-5">
            <p className="text-sm text-slate-400">
              Coding Score
            </p>

            <p className="text-3xl font-bold text-cyan-300 mt-1">
              {stats.coding_score}%
            </p>
          </div>

        </div>

        <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6 mb-6">

          <h3 className="text-lg font-bold mb-4">
            Questions
          </h3>

          <div className="flex flex-wrap gap-2">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => goToQuestion(index)}
                className={`w-10 h-10 rounded-lg text-sm font-medium ${
                  currentIndex === index
                    ? "bg-cyan-400 text-white"
                    : codingResults[String(q.id)] === true
                    ? "bg-green-500 text-white"
                    : codingResults[String(q.id)] === false
                    ? "bg-red-500 text-white"
                    : "bg-[#0b1018]/10 text-slate-200 hover:bg-gray-300"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm">

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-cyan-400"></span>
              Current
            </div>

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-green-500"></span>
              Correct
            </div>

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-red-500"></span>
              Incorrect
            </div>

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-[#0b1018]/10"></span>
              Not Attempted
            </div>

          </div>

        </div>

        {currentIndex < questions.length ? (
          <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">

            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-semibold text-cyan-300">
                Question {currentIndex + 1}
              </span>

              <span className="text-sm text-slate-400">
                {questions.length} Questions
              </span>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <span>
                  {Math.round(((currentIndex + 1) / questions.length) * 100)}%
                </span>
              </div>

              <div className="w-full bg-[#0b1018]/10 rounded-full h-2">
                <div
                  className="bg-cyan-400 h-2 rounded-full"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`
                  }}
                ></div>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-cyan-400/10 text-blue-700 text-sm">
                {question.category}
              </span>

              <span className="px-3 py-1 rounded-full bg-[#0b1018]/[0.06] text-slate-200 text-sm">
                {question.difficulty}
              </span>
            </div>

            <h3 className="text-xl font-bold mb-6">
              {question.question}
            </h3>

            <div className="space-y-3">

              {question.options.map((option) => (
                <button
                  key={option}
                  onClick={() => setSelectedAnswer(option)}
                  disabled={
                    !!result ||
                    attemptedQuestionIds.includes(question.id)
                  }
                  className={`w-full text-left p-3 rounded-lg border ${
                    selectedAnswer === option
                      ? "border-blue-600 bg-blue-50"
                      : "border-white/10"
                  } ${
                    result || attemptedQuestionIds.includes(question.id)
                      ? "cursor-not-allowed opacity-70"
                      : "hover:bg-[#0b1018]/[0.03]"
                  }`}
                >
                  {option}
                </button>
              ))}

            </div>

            <button
              onClick={submitAnswer}
              disabled={
                !!result ||
                attemptedQuestionIds.includes(question.id)
              }
              className="mt-6 bg-cyan-400 hover:bg-cyan-300 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {result
                ? "Answer Submitted"
                : attemptedQuestionIds.includes(question.id)
                ? "Already Attempted"
                : "Submit Answer"}
            </button>

            {result && (
              <div className="mt-6">

                <div
                  className={`rounded-xl p-4 ${
                    result.correct
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  <p className="font-bold">
                    {result.correct
                      ? "✅ Correct Answer!"
                      : "❌ Incorrect Answer"}
                  </p>

                  {!result.correct && result.correct_answer && (
                    <p className="mt-2">
                      Correct answer: <strong>{result.correct_answer}</strong>
                    </p>
                  )}

                  <p className="text-sm mt-1">
                    Coding Score: {result.coding_score}%
                  </p>

                  <p className="text-sm">
                    Problems Solved: {result.problems_solved}
                  </p>
                </div>

                {currentIndex === questions.length - 1 && (
                  <div className="mt-4 bg-blue-50 text-blue-700 rounded-xl p-4 font-semibold">
                    🎉 You completed all coding questions!
                  </div>
                )}

              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => goToQuestion(Math.max(currentIndex - 1, 0))}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-lg bg-[#0b1018]/10 disabled:opacity-50"
              >
                ← Previous
              </button>

              <button
                onClick={() => {
                  if (currentIndex < questions.length - 1) {
                    goToQuestion(currentIndex + 1);
                  }
                }}
                disabled={currentIndex === questions.length - 1}
                className="px-4 py-2 rounded-lg bg-cyan-400 text-white disabled:opacity-50"
              >
                Next →
              </button>
            </div>

          </div>
        ) : (
          <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-8 text-center">
            <h3 className="text-2xl font-bold">
              🏆 Final Coding Result
            </h3>

            <p className="text-4xl font-bold text-cyan-300 mt-5">
              {stats.coding_score}%
            </p>

            <div className="text-2xl font-bold mb-4">
              {getCodingPerformance(stats.coding_score)}
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mt-2">
              <div>
                <p className="text-xl font-bold">
                  {stats.attempted}/{stats.total_questions}
                </p>
                <p className="text-xs text-slate-400">
                  Attempted
                </p>
              </div>

              <div>
                <p className="text-xl font-bold text-green-600">
                  {stats.correct}
                </p>
                <p className="text-xs text-slate-400">
                  Correct
                </p>
              </div>

              <div>
                <p className="text-xl font-bold text-orange-600">
                  {stats.accuracy}%
                </p>
                <p className="text-xs text-slate-400">
                  Accuracy
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}


/* Aptitude Page */
function AptitudePage({ student }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [stats, setStats] = useState({
    total_questions: 0,
    attempted: 0,
    correct: 0,
    accuracy: 0,
    aptitude_score: 0
  });
  const [loading, setLoading] = useState(true);
  const [attemptedQuestionIds, setAttemptedQuestionIds] = useState([]);
  const [aptitudeResults, setAptitudeResults] = useState({});

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await apiFetch(
          `${API_BASE}/aptitude/questions`
        );

        const data = await response.json();

        if (response.ok) {
          setQuestions(data);
        }
      } catch (error) {
        console.error("Could not load aptitude questions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/aptitude/stats/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setStats(data);
        }
      } catch (error) {
        console.error("Could not load aptitude statistics:", error);
      }
    };

    loadStats();
  }, [student]);

  useEffect(() => {
    const loadAttempted = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/aptitude/attempted/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setAttemptedQuestionIds(data.attempted_question_ids || []);
        }
      } catch (error) {
        console.error("Could not load attempted aptitude questions:", error);
      }
    };

    loadAttempted();
  }, [student]);

  useEffect(() => {
    const loadResults = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/aptitude/results/${student.id}`
        );

        const data = await response.json();

        if (response.ok) {
          setAptitudeResults(data);
        }
      } catch (error) {
        console.error("Could not load aptitude results:", error);
      }
    };

    loadResults();
  }, [student]);

  const submitAnswer = async () => {
    if (!selectedAnswer) {
      alert("Please select an answer.");
      return;
    }

    if (!student?.id) {
      alert("Student profile not found.");
      return;
    }

    const question = questions[currentIndex];

    try {
      const response = await apiFetch(
        `${API_BASE}/aptitude/${student.id}/submit?question_id=${question.id}&answer=${encodeURIComponent(selectedAnswer)}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Could not submit answer.");
        return;
      }

      setResult(data);

      setStats((prev) => ({
        ...prev,
        attempted: data.questions_attempted,
        correct: data.correct_answers,
        aptitude_score: data.aptitude_score,
        accuracy:
          data.questions_attempted > 0
            ? Math.round(
                (data.correct_answers / data.questions_attempted) * 100
              )
            : 0,
      }));

      setAttemptedQuestionIds((prev) =>
        prev.includes(question.id) ? prev : [...prev, question.id]
      );

      setAptitudeResults((prev) => ({
        ...prev,
        [String(question.id)]: data.correct
      }));
    } catch (error) {
      console.error(error);
      alert("Could not connect to backend.");
    }
  };

  const goToQuestion = (index) => {
    setCurrentIndex(index);
    setSelectedAnswer("");

    const targetQuestion = questions[index];

    if (
      targetQuestion &&
      aptitudeResults[String(targetQuestion.id)] !== undefined
    ) {
      setResult({
        correct: aptitudeResults[String(targetQuestion.id)]
      });
    } else {
      setResult(null);
    }
  };

  if (loading) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-400">
            Loading aptitude questions...
          </p>
        </div>
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">
            <h2 className="text-xl font-bold">
              No aptitude questions available.
            </h2>
          </div>
        </div>
      </section>
    );
  }

  const question = questions[currentIndex];

  const isAptitudeTestCompleted =
    stats.total_questions > 0 &&
    stats.attempted === stats.total_questions;

  const getAptitudePerformance = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Average";
    return "Needs Improvement";
  };

  return (
    <section className="p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            🧮 Aptitude Practice
          </h2>

          <p className="text-slate-400 mt-1">
            Sharpen your quantitative and logical reasoning skills.
          </p>
        </div>

        {isAptitudeTestCompleted ? (
          <div className="inline-flex items-center px-4 py-2 mb-6 rounded-full bg-green-100 text-green-700 font-semibold">
            ✅ Aptitude Test Completed
          </div>
        ) : (
          <div className="inline-flex items-center px-4 py-2 mb-6 rounded-full bg-cyan-400/10 text-blue-700 font-semibold">
            📝 Test In Progress
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">

          <div className="bg-[#0b1018] rounded-xl border p-5">
            <p className="text-sm text-slate-400">
              Total Questions
            </p>

            <p className="text-3xl font-bold text-purple-600 mt-1">
              {stats.total_questions}
            </p>
          </div>

          <div className="bg-[#0b1018] rounded-xl border p-5">
            <p className="text-sm text-slate-400">
              Attempted
            </p>

            <p className="text-3xl font-bold text-cyan-300 mt-1">
              {stats.attempted}
            </p>
          </div>

          <div className="bg-[#0b1018] rounded-xl border p-5">
            <p className="text-sm text-slate-400">
              Correct
            </p>

            <p className="text-3xl font-bold text-green-600 mt-1">
              {stats.correct}
            </p>
          </div>

          <div className="bg-[#0b1018] rounded-xl border p-5">
            <p className="text-sm text-slate-400">
              Accuracy
            </p>

            <p className="text-3xl font-bold text-orange-600 mt-1">
              {stats.accuracy}%
            </p>
          </div>

          <div className="bg-[#0b1018] rounded-xl border p-5">
            <p className="text-sm text-slate-400">
              Aptitude Score
            </p>

            <p className="text-3xl font-bold text-cyan-300 mt-1">
              {stats.aptitude_score}%
            </p>
          </div>

        </div>

        <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6 mb-6">

          <h3 className="text-lg font-bold mb-4">
            Questions
          </h3>

          <div className="flex flex-wrap gap-2 mb-4">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => goToQuestion(index)}
                className={`w-10 h-10 rounded-lg text-sm font-medium ${
                  currentIndex === index
                    ? "bg-cyan-400 text-white"
                    : aptitudeResults[String(q.id)] === true
                    ? "bg-green-500 text-white"
                    : aptitudeResults[String(q.id)] === false
                    ? "bg-red-500 text-white"
                    : "bg-[#0b1018]/10 text-slate-200 hover:bg-gray-300"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div className="w-full bg-[#0b1018]/10 rounded-full h-3 mb-2">
            <div
              className="bg-cyan-400 h-3 rounded-full"
              style={{
                width: `${
                  stats.total_questions > 0
                    ? (stats.attempted / stats.total_questions) * 100
                    : 0
                }%`,
              }}
            ></div>
          </div>

          <p className="text-sm text-slate-400 mb-4">
            {stats.attempted} of {stats.total_questions} questions attempted
          </p>

          <div className="flex flex-wrap gap-4 text-sm">

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-cyan-400"></span>
              Current
            </div>

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-green-500"></span>
              Correct
            </div>

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-red-500"></span>
              Incorrect
            </div>

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-[#0b1018]/10"></span>
              Not Attempted
            </div>

          </div>

        </div>

        {currentIndex < questions.length ? (
          <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">

            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-semibold text-cyan-300">
                Question {currentIndex + 1}
              </span>

              <span className="text-sm text-slate-400">
                {questions.length} Questions
              </span>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Question {currentIndex + 1} of {questions.length}</span>
                <span>
                  {Math.round(((currentIndex + 1) / questions.length) * 100)}%
                </span>
              </div>

              <div className="w-full bg-[#0b1018]/10 rounded-full h-2">
                <div
                  className="bg-cyan-400 h-2 rounded-full"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`
                  }}
                ></div>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-cyan-400/10 text-blue-700 text-sm">
                {question.category}
              </span>

              <span className="px-3 py-1 rounded-full bg-[#0b1018]/[0.06] text-slate-200 text-sm">
                {question.difficulty}
              </span>
            </div>

            <h3 className="text-xl font-bold mb-6">
              {question.question}
            </h3>

            <div className="space-y-3">

              {[
                question.option_a,
                question.option_b,
                question.option_c,
                question.option_d
              ].map((option) => (
                <button
                  key={option}
                  onClick={() => setSelectedAnswer(option)}
                  disabled={
                    !!result ||
                    attemptedQuestionIds.includes(question.id)
                  }
                  className={`w-full text-left p-3 rounded-lg border ${
                    selectedAnswer === option
                      ? "border-blue-600 bg-blue-50"
                      : "border-white/10"
                  } ${
                    result || attemptedQuestionIds.includes(question.id)
                      ? "cursor-not-allowed opacity-70"
                      : "hover:bg-[#0b1018]/[0.03]"
                  }`}
                >
                  {option}
                </button>
              ))}

            </div>

            <button
              onClick={submitAnswer}
              disabled={
                !!result ||
                attemptedQuestionIds.includes(question.id)
              }
              className="mt-6 bg-cyan-400 hover:bg-cyan-300 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {result
                ? "Answer Submitted"
                : attemptedQuestionIds.includes(question.id)
                ? "Already Attempted"
                : "Submit Answer"}
            </button>

            {result && (
              <div className="mt-6">

                <div
                  className={`rounded-xl p-4 ${
                    result.correct
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  <p className="font-bold">
                    {result.correct
                      ? "✅ Correct Answer!"
                      : "❌ Incorrect Answer"}
                  </p>

                  {!result.correct && result.correct_answer && (
                    <p className="mt-2">
                      Correct answer: <strong>{result.correct_answer}</strong>
                    </p>
                  )}

                  {typeof result.aptitude_score === "number" && (
                    <p className="text-sm mt-1">
                      Aptitude Score: {result.aptitude_score}%
                    </p>
                  )}
                </div>

                {currentIndex === questions.length - 1 && (
                  <div className="mt-4 bg-blue-50 text-blue-700 rounded-xl p-4 font-semibold">
                    🎉 You completed all aptitude questions!
                  </div>
                )}

              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => goToQuestion(Math.max(currentIndex - 1, 0))}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-lg bg-[#0b1018]/10 disabled:opacity-50"
              >
                ← Previous
              </button>

              <button
                onClick={() => {
                  if (currentIndex < questions.length - 1) {
                    goToQuestion(currentIndex + 1);
                  }
                }}
                disabled={currentIndex === questions.length - 1}
                className="px-4 py-2 rounded-lg bg-cyan-400 text-white disabled:opacity-50"
              >
                Next →
              </button>
            </div>

          </div>
        ) : (
          <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-8 text-center">
            <h3 className="text-2xl font-bold">
              🏆 Final Aptitude Result
            </h3>

            <p className="text-4xl font-bold text-cyan-300 mt-5">
              {stats.aptitude_score}%
            </p>

            <div className="text-2xl font-bold mb-4">
              {getAptitudePerformance(stats.aptitude_score)}
            </div>

            <p className="text-slate-400 mb-2">
              {stats.correct} correct out of {stats.total_questions}
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mt-2">
              <div>
                <p className="text-xl font-bold">
                  {stats.attempted}/{stats.total_questions}
                </p>
                <p className="text-xs text-slate-400">
                  Attempted
                </p>
              </div>

              <div>
                <p className="text-xl font-bold text-green-600">
                  {stats.correct}
                </p>
                <p className="text-xs text-slate-400">
                  Correct
                </p>
              </div>

              <div>
                <p className="text-xl font-bold text-orange-600">
                  {stats.accuracy}%
                </p>
                <p className="text-xs text-slate-400">
                  Accuracy
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}


/* Interview Page */
function InterviewPage({ student }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(
    student?.target_role || "Software Developer"
  );
  const [evaluation, setEvaluation] = useState(null);
  const [realAiAnalysis, setRealAiAnalysis] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [interviewStats, setInterviewStats] = useState(null);
  const [interviewRecommendations, setInterviewRecommendations] = useState([]);

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await apiFetch(
          `${API_BASE}/interview/questions?target_role=${encodeURIComponent(selectedRole)}`
        );

        const data = await response.json();

        if (response.ok) {
          setQuestions(data);
        }
      } catch (error) {
        console.error("Could not load interview questions:", error);
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [selectedRole]);

  const loadInterviewStats = async () => {
    if (!student?.id) return;

    try {
      const response = await apiFetch(
        `${API_BASE}/interview/stats/${student.id}`
      );

      const data = await response.json();

      if (response.ok) {
        setInterviewStats(data);
      }
    } catch (error) {
      console.error(
        "Could not load interview statistics:",
        error
      );
    }
  };

  const loadInterviewRecommendations = async () => {
    if (!student?.id) return;

    try {
      const response = await apiFetch(
        `${API_BASE}/interview/recommendations/${student.id}`
      );

      const data = await response.json();

      if (response.ok) {
        setInterviewRecommendations(
          data.recommendations || []
        );
      }
    } catch (error) {
      console.error(
        "Could not load interview recommendations:",
        error
      );
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;

    if (!student?.id) {
      alert("Student profile not found.");
      return;
    }

    const question = questions[currentIndex];

    setEvaluating(true);

    try {
      // Save the answer
      const submitResponse = await apiFetch(
        `${API_BASE}/interview/${student.id}/submit?question_id=${question.id}&answer=${encodeURIComponent(answer)}`,
        {
          method: "POST",
        }
      );

      const submitData = await submitResponse.json();

      if (!submitResponse.ok) {
        alert(submitData.detail || "Unable to submit answer");
        return;
      }

      // Evaluate the answer
      const evaluationResponse = await apiFetch(
        `${API_BASE}/interview/evaluate?question_id=${question.id}&answer=${encodeURIComponent(answer)}`,
        {
          method: "POST",
        }
      );

      const evaluationData = await evaluationResponse.json();

      if (!evaluationResponse.ok) {
        alert(
          evaluationData.detail ||
          "Unable to evaluate answer"
        );
        return;
      }

      setEvaluation(evaluationData);
      setRealAiAnalysis(evaluationData.coaching?.real_ai_analysis || "");
      setSubmitted(true);

      await loadInterviewStats();
      await loadInterviewRecommendations();

    } catch (error) {
      console.error(error);
      alert("Could not connect to backend.");
    } finally {
      setEvaluating(false);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer("");
      setSubmitted(false);
      setEvaluation(null);
      setRealAiAnalysis("");
    }
  };

  const previousQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setAnswer("");
      setSubmitted(false);
      setEvaluation(null);
      setRealAiAnalysis("");
    }
  };

  if (loading) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-400">
            Loading interview questions...
          </p>
        </div>
      </section>
    );
  }

  if (!questions.length) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">
            <h2 className="text-xl font-bold">
              No interview questions available.
            </h2>
          </div>
        </div>
      </section>
    );
  }

  const question = questions[currentIndex];

  return (
    <section className="p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">

        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            🎤 Interview Preparation
          </h2>

          <p className="text-slate-400 mt-1">
            Question {currentIndex + 1} of {questions.length}
          </p>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-200 mb-2">
              Target Role
            </label>

            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setCurrentIndex(0);
                setAnswer("");
                setSubmitted(false);
              }}
              className="border border-white/10 rounded-lg px-4 py-2 bg-[#0b1018]"
            >
              <option value="Software Developer">
                Software Developer
              </option>

              <option value="Frontend Developer">
                Frontend Developer
              </option>

              <option value="Backend Developer">
                Backend Developer
              </option>

              <option value="Data Analyst">
                Data Analyst
              </option>

              <option value="Data Scientist">
                Data Scientist
              </option>
            </select>
          </div>
        </div>

        <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">

          <div className="flex gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-cyan-400/10 text-blue-700 text-sm">
              {question.category}
            </span>

            <span className="px-3 py-1 rounded-full bg-[#0b1018]/[0.06] text-slate-200 text-sm">
              {question.difficulty}
            </span>
          </div>

          <h3 className="text-xl font-bold mb-6">
            {question.question}
          </h3>

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Write your answer here..."
            className="w-full min-h-40 border border-white/10 rounded-lg p-4 disabled:opacity-70 disabled:cursor-not-allowed"
          />

          <div className="flex gap-3 mt-5">

            <button
              onClick={submitAnswer}
              disabled={!answer.trim() || submitted}
              className="px-5 py-2 bg-cyan-400 hover:bg-cyan-300 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {evaluating
                ? "Evaluating..."
                : submitted
                  ? "Answer Submitted"
                  : "Submit Answer"}
            </button>

            <button
              onClick={previousQuestion}
              disabled={currentIndex === 0}
              className="px-5 py-2 bg-[#0b1018]/10 rounded-lg disabled:opacity-50"
            >
              ← Previous
            </button>

            {currentIndex < questions.length - 1 && (
              <button
                onClick={nextQuestion}
                disabled={!submitted}
                className="px-5 py-2 bg-[#0b1018]/10 rounded-lg disabled:opacity-50"
              >
                Next →
              </button>
            )}

          </div>

          {submitted && (
            <div className="mt-5 p-4 bg-green-50 text-green-700 rounded-lg">
              ✅ Answer submitted successfully.
            </div>
          )}

          {evaluation && (
            <div className="mt-5 rounded-xl border bg-[#05070d] p-5">
              <h4 className="text-lg font-bold text-slate-800">
                🧠 Interview Feedback
              </h4>

              <div className="mt-4">
                <p className="text-sm text-slate-400">
                  Answer Score
                </p>

                <p className="text-3xl font-bold text-cyan-300">
                  {evaluation.score}/100
                </p>
              </div>

              <div className="mt-4">
                <p className="font-semibold text-slate-200">
                  Feedback
                </p>

                <ul className="mt-2 space-y-2">
                  {evaluation.feedback.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-lg bg-[#0b1018] p-3 text-sm text-slate-200 border"
                    >
                      • {item}
                    </li>
                  ))}
                </ul>
              </div>

              {evaluation?.coaching && (
                <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.03] p-6">

                  <div className="mb-5">
                    <h3 className="text-xl font-bold text-white">
                      AI Interview Coach
                    </h3>

                    <p className="mt-1 text-sm text-slate-400">
                      Personalized feedback to improve your interview answers.
                    </p>
                  </div>

                  {evaluation.coaching.strengths?.length > 0 && (
                    <div className="mb-5">
                      <h4 className="mb-2 font-semibold text-cyan-300">
                        ✓ Strengths
                      </h4>

                      <div className="space-y-2">
                        {evaluation.coaching.strengths.map((item, index) => (
                          <p key={index} className="text-sm text-slate-300">
                            • {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {evaluation.coaching.improvements?.length > 0 && (
                    <div className="mb-5">
                      <h4 className="mb-2 font-semibold text-purple-300">
                        ⚡ Improve
                      </h4>

                      <div className="space-y-2">
                        {evaluation.coaching.improvements.map((item, index) => (
                          <p key={index} className="text-sm text-slate-300">
                            • {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {evaluation.coaching.action_items?.length > 0 && (
                    <div>
                      <h4 className="mb-2 font-semibold text-white">
                        🎯 Action Plan
                      </h4>

                      <div className="space-y-2">
                        {evaluation.coaching.action_items.map((item, index) => (
                          <p key={index} className="text-sm text-slate-300">
                            • {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {realAiAnalysis && (
                <div className="mt-6 rounded-2xl border border-purple-400/20 bg-white/[0.03] p-6 shadow-[0_0_35px_rgba(168,85,247,0.08)]">

                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-11 w-11 rounded-xl bg-purple-400/10 flex items-center justify-center text-xl">
                      🤖
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Real AI Interview Coach
                      </h3>

                      <p className="text-sm text-slate-400">
                        Personalized feedback on your interview answer
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                    <p className="whitespace-pre-line text-slate-200 leading-7">
                      {realAiAnalysis}
                    </p>
                  </div>

                </div>
              )}
            </div>
          )}

          {submitted && currentIndex === questions.length - 1 && (
            <div className="mt-4 bg-blue-50 text-blue-700 rounded-xl p-4 font-semibold">
              🎉 You've answered all interview questions!
            </div>
          )}

        </div>

        {interviewStats && (
          <div className="mt-6 rounded-2xl border bg-[#0b1018] p-6 shadow-sm">
            <h3 className="text-xl font-bold">
              📊 Interview Performance
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">

              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-sm text-slate-400">
                  Questions Attempted
                </p>

                <p className="text-2xl font-bold text-cyan-300">
                  {interviewStats.attempted}
                </p>
              </div>

              <div className="rounded-xl bg-green-50 p-4">
                <p className="text-sm text-slate-400">
                  Average Score
                </p>

                <p className="text-2xl font-bold text-green-600">
                  {interviewStats.average_score}
                </p>
              </div>

              <div className="rounded-xl bg-purple-50 p-4">
                <p className="text-sm text-slate-400">
                  Performance
                </p>

                <p className="text-2xl font-bold text-purple-600">
                  {interviewStats.average_score >= 80
                    ? "Excellent"
                    : interviewStats.average_score >= 60
                      ? "Good"
                      : "Needs Improvement"}
                </p>
              </div>

            </div>
          </div>
        )}

        {interviewRecommendations.length > 0 && (
          <div className="mt-6 rounded-2xl border bg-[#0b1018] p-6 shadow-sm">
            <h3 className="text-xl font-bold">
              🚀 How to Improve
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              Personalized suggestions based on your interview performance.
            </p>

            <div className="mt-4 space-y-3">
              {interviewRecommendations.map(
                (recommendation, index) => (
                  <div
                    key={index}
                    className="flex gap-3 rounded-xl bg-blue-50 p-4"
                  >
                    <span className="font-bold text-cyan-300">
                      {index + 1}.
                    </span>

                    <p className="text-sm text-slate-200">
                      {recommendation}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}


/* Companies Page */
function CompaniesPage({ student }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [preparation, setPreparation] = useState(null);
  const [preparationLoading, setPreparationLoading] = useState(false);
  const [completedSkills, setCompletedSkills] = useState([]);
  const [matchData, setMatchData] = useState({});
  const [matchLoading, setMatchLoading] = useState({});

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const response = await apiFetch(
          `${API_BASE}/companies`
        );

        const data = await response.json();

        if (response.ok) {
          setCompanies(data);
        }
      } catch (error) {
        console.error("Could not load companies:", error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, []);

  const filteredCompanies = companies.filter((company) => {
    const term = search.trim().toLowerCase();

    if (!term) return true;

    return (
      company.name.toLowerCase().includes(term) ||
      company.role.toLowerCase().includes(term) ||
      company.skills.toLowerCase().includes(term)
    );
  });

  const loadPreparation = async (companyId) => {
    setPreparationLoading(true);

    try {
      const response = await apiFetch(
        `${API_BASE}/companies/${companyId}/preparation`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not load preparation"
        );
      }

      setSelectedCompany(companyId);
      setPreparation(data);

      const progressResponse = await apiFetch(
        `${API_BASE}/companies/${companyId}/preparation/progress?student_id=${student.id}`
      );

      const progressData = await progressResponse.json();

      if (progressResponse.ok) {
        setCompletedSkills(
          progressData.completed_skills || []
        );
      } else {
        setCompletedSkills([]);
      }
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
      setPreparationLoading(false);
    }
  };

  const toggleSkill = async (skill) => {
    if (!selectedCompany || !student?.id) {
      return;
    }

    const isCompleted = completedSkills.includes(skill);

    setCompletedSkills((previous) => {
      if (isCompleted) {
        return previous.filter((item) => item !== skill);
      }

      return [...previous, skill];
    });

    try {
      const response = await apiFetch(
        `${API_BASE}/companies/${selectedCompany}/preparation/${encodeURIComponent(skill)}?completed=${!isCompleted}&student_id=${student.id}`,
        {
          method: "PUT",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not update preparation"
        );
      }
    } catch (error) {
      console.error(error);

      // Roll back UI if database update fails
      setCompletedSkills((previous) => {
        if (isCompleted) {
          return [...previous, skill];
        }

        return previous.filter((item) => item !== skill);
      });

      alert(error.message);
    }
  };

  const totalSkills = preparation?.checklist?.length || 0;

  const preparationProgress =
    totalSkills > 0
      ? Math.round((completedSkills.length / totalSkills) * 100)
      : 0;

  const loadCompanyMatch = async (companyId) => {
    if (!student?.id) return;

    setMatchLoading((prev) => ({
      ...prev,
      [companyId]: true,
    }));

    try {
      const response = await apiFetch(
        `${API_BASE}/companies/${companyId}/match?student_id=${student.id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to calculate company match"
        );
      }

      setMatchData((prev) => ({
        ...prev,
        [companyId]: data,
      }));
    } catch (error) {
      console.error("Company match error:", error);
      alert(error.message);
    } finally {
      setMatchLoading((prev) => ({
        ...prev,
        [companyId]: false,
      }));
    }
  };

  useEffect(() => {
    if (!companies.length || !student?.id) return;

    companies.forEach((company) => {
      if (!matchData[company.id]) {
        loadCompanyMatch(company.id);
      }
    });
  }, [companies, student?.id]);

  const getMatchLevel = (score) => {
    if (score >= 80) {
      return "Excellent Match";
    }

    if (score >= 60) {
      return "Good Match";
    }

    if (score >= 40) {
      return "Moderate Match";
    }

    return "Needs Improvement";
  };

  if (loading) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-slate-400">
            Loading companies...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">

        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            🏢 Companies
          </h2>

          <p className="text-slate-400 mt-1">
            Explore companies that hire for your target role.
          </p>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company, role, or skill..."
          className="w-full border border-white/10 rounded-lg px-4 py-3 mb-6"
        />

        {filteredCompanies.length === 0 ? (
          <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6 text-center text-slate-400">
            No companies match your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="bg-[#0b1018] rounded-2xl border shadow-sm p-6"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold">
                    {company.name}
                  </h3>

                  <span className="px-3 py-1 rounded-full bg-cyan-400/10 text-blue-700 text-xs font-semibold">
                    {company.package}
                  </span>
                </div>

                <p className="text-slate-300 font-medium mb-3">
                  {company.role}
                </p>

                <div className="space-y-2 text-sm">
                  <p className="text-slate-400">
                    <span className="font-semibold text-slate-200">
                      Eligibility:
                    </span>{" "}
                    {company.eligibility}
                  </p>

                  <p className="text-slate-400">
                    <span className="font-semibold text-slate-200">
                      Skills:
                    </span>{" "}
                    {company.skills}
                  </p>
                </div>

                <button
                  onClick={() => loadCompanyMatch(company.id)}
                  className="mt-4 w-full rounded-lg bg-cyan-400 px-4 py-2 text-white hover:bg-cyan-300"
                >
                  {matchLoading[company.id]
                    ? "Calculating..."
                    : "Check Match Score"}
                </button>

                {matchLoading[company.id] && (
                  <div className="mt-4 rounded-lg border p-4 text-center text-sm text-slate-400">
                    Calculating match...
                  </div>
                )}

                {matchData[company.id] && (
                  <div className="mt-4 rounded-xl border p-4">

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">
                          Your Match Score
                        </p>

                        <p className="text-3xl font-bold">
                          {matchData[company.id].match_score}%
                        </p>

                        <p className="mt-1 text-sm font-medium">
                          {getMatchLevel(
                            matchData[company.id].match_score
                          )}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm">
                          {matchData[company.id].eligible
                            ? "✅ Eligible"
                            : "❌ Not Eligible"}
                        </p>

                        <p className="mt-2 text-sm text-slate-400">
                          {matchData[company.id].matched_skills?.length || 0}
                          {" "}skills matched
                        </p>
                      </div>
                    </div>

                    {matchData[company.id].matched_skills?.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-semibold text-white">
                          ✓ Matching Skills
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {matchData[company.id].matched_skills.map(
                            (skill, index) => (
                              <span
                                key={index}
                                className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300"
                              >
                                {skill}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {matchData[company.id].missing_skills?.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-semibold text-white">
                          ⚡ Skills to Improve
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {matchData[company.id].missing_skills.map(
                            (skill, index) => (
                              <span
                                key={index}
                                className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-300"
                              >
                                {skill}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {matchData[company.id].recommendations?.length > 0 && (
                      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="mb-3 text-sm font-semibold text-white">
                          🎯 Personalized Recommendations
                        </p>

                        <div className="space-y-2">
                          {matchData[company.id].recommendations
                            .slice(0, 4)
                            .map((recommendation, index) => (
                              <p
                                key={index}
                                className="text-sm leading-5 text-slate-300"
                              >
                                • {recommendation}
                              </p>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">

                      {[
                        ["Skills", matchData[company.id].skill_match_score],
                        ["Resume", matchData[company.id].resume_score],
                        ["Coding", matchData[company.id].coding_score],
                        ["Aptitude", matchData[company.id].aptitude_score],
                        ["Projects", matchData[company.id].project_score],
                        ["Interview", matchData[company.id].interview_score],
                      ].map(([label, score]) => (
                        <div
                          key={label}
                          className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                        >
                          <p className="text-xs text-slate-500">
                            {label}
                          </p>

                          <p className="mt-1 text-lg font-bold text-white">
                            {score ?? 0}%
                          </p>
                        </div>
                      ))}

                    </div>

                  </div>
                )}

                <button
                  onClick={() => loadPreparation(company.id)}
                  className="mt-5 w-full rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-white hover:bg-cyan-300"
                >
                  📚 View Preparation
                </button>
              </div>
            ))}
          </div>
        )}

        {preparationLoading && (
          <div className="mt-6 rounded-2xl border bg-[#0b1018] p-6 shadow-sm">
            <p className="text-slate-400">
              Loading preparation plan...
            </p>
          </div>
        )}

        {preparation && !preparationLoading && (
          <div className="mt-6 rounded-2xl border bg-[#0b1018] p-6 shadow-sm">

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">
                  🎯 {preparation.company} Preparation
                </h3>

                <p className="mt-1 text-slate-400">
                  Target Role: {preparation.role}
                </p>
              </div>

              <button
                onClick={() => {
                  setPreparation(null);
                  setSelectedCompany(null);
                  setCompletedSkills([]);
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-200">
                <span>Preparation Progress</span>
                <span>{preparationProgress}%</span>
              </div>

              <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-cyan-400"
                  style={{ width: `${preparationProgress}%` }}
                />
              </div>

              <div className="mt-2 text-sm text-slate-400">
                {completedSkills.length} / {totalSkills} skills completed
              </div>

              <div className="mt-3">
                {preparationProgress === 100 ? (
                  <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                    🟢 Fully Prepared
                  </span>
                ) : preparationProgress >= 60 ? (
                  <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-700">
                    🟡 Good Progress
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                    🔴 Keep Preparing
                  </span>
                )}
              </div>

              <div className="mt-5 rounded-xl bg-[#05070d] p-4">
                <p className="text-sm font-semibold text-slate-200">
                  Preparation Summary
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Complete the skills above to improve your readiness
                  for {preparation.company}.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="rounded-xl bg-blue-50 p-5">
                <h4 className="font-bold text-blue-700">
                  💻 Coding Focus
                </h4>

                <ul className="mt-3 space-y-2">
                  {preparation.coding_focus.length > 0 ? (
                    preparation.coding_focus.map((skill) => (
                      <li
                        key={skill}
                        className="text-sm text-slate-200"
                      >
                        • {skill}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-slate-400">
                      No specific coding focus
                    </li>
                  )}
                </ul>
              </div>

              <div className="rounded-xl bg-green-50 p-5">
                <h4 className="font-bold text-green-700">
                  🧠 Aptitude Focus
                </h4>

                <ul className="mt-3 space-y-2">
                  {preparation.aptitude_focus.length > 0 ? (
                    preparation.aptitude_focus.map((skill) => (
                      <li
                        key={skill}
                        className="text-sm text-slate-200"
                      >
                        • {skill}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-slate-400">
                      No specific aptitude focus
                    </li>
                  )}
                </ul>
              </div>

              <div className="rounded-xl bg-purple-50 p-5">
                <h4 className="font-bold text-purple-700">
                  🎤 Interview Focus
                </h4>

                <ul className="mt-3 space-y-2">
                  {preparation.interview_focus.length > 0 ? (
                    preparation.interview_focus.map((skill) => (
                      <li
                        key={skill}
                        className="text-sm text-slate-200"
                      >
                        • {skill}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-slate-400">
                      No specific interview focus
                    </li>
                  )}
                </ul>
              </div>

            </div>

            <div className="mt-6">
              <h4 className="text-lg font-bold">
                ✅ Preparation Checklist
              </h4>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {preparation.checklist.map((item) => {
                  const isCompleted = completedSkills.includes(item.skill);

                  return (
                    <button
                      key={item.skill}
                      onClick={() => toggleSkill(item.skill)}
                      className={`text-left rounded-lg border p-3 transition ${
                        isCompleted
                          ? "bg-green-50 border-green-200"
                          : "bg-[#05070d] hover:bg-slate-100"
                      }`}
                    >
                      <span
                        className={`text-sm font-medium ${
                          isCompleted
                            ? "text-green-700 line-through"
                            : "text-slate-200"
                        }`}
                      >
                        {isCompleted ? "☑" : "☐"} {item.skill}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>
    </section>
  );
}


/* Projects Page */
function ProjectsPage({ student }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    technology: "",
    status: "Not Started",
  });

  const loadProjects = async () => {
    if (!student?.id) return;

    try {
      const response = await apiFetch(
        `${API_BASE}/projects/${student.id}/list`
      );

      const data = await response.json();

      if (response.ok) {
        setProjects(data);
      }
    } catch (error) {
      console.error("Could not load projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [student]);

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      technology: "",
      status: "Not Started",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const startEdit = (project) => {
    setForm({
      name: project.name,
      description: project.description,
      technology: project.technology,
      status: project.status,
    });
    setEditingId(project.id);
    setShowForm(true);
  };

  const saveProject = async () => {
    if (!form.name.trim()) {
      alert("Project name is required.");
      return;
    }

    if (!student?.id) {
      alert("Student profile not found.");
      return;
    }

    try {
      const url = editingId
        ? `${API_BASE}/projects/${editingId}`
        : `${API_BASE}/projects/${student.id}/add`;

      const response = await apiFetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Could not save project.");
        return;
      }

      resetForm();
      loadProjects();
    } catch (error) {
      console.error(error);
      alert("Could not connect to backend.");
    }
  };

  const deleteProject = async (projectId) => {
    if (!window.confirm("Delete this project?")) return;

    try {
      const response = await apiFetch(
        `${API_BASE}/projects/${projectId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Could not delete project.");
        return;
      }

      loadProjects();
    } catch (error) {
      console.error(error);
      alert("Could not connect to backend.");
    }
  };

  const statusColors = {
    "Not Started": "bg-[#0b1018]/[0.06] text-slate-200",
    "In Progress": "bg-cyan-400/10 text-blue-700",
    "Completed": "bg-green-100 text-green-700",
  };

  if (loading) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-400">
            Loading projects...
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">

        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">
              🏗️ Projects
            </h2>

            <p className="text-slate-400 mt-1">
              Track the projects you're building for placements.
            </p>
          </div>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-cyan-400 hover:bg-cyan-300 text-white px-5 py-2 rounded-lg font-semibold"
            >
              + Add Project
            </button>
          )}
        </div>

        {showForm && (
          <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6 mb-6">

            <h3 className="text-lg font-bold mb-4">
              {editingId ? "Edit Project" : "New Project"}
            </h3>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Project Name
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full border border-white/10 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  className="w-full min-h-24 border border-white/10 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Technologies
                </label>
                <input
                  name="technology"
                  value={form.technology}
                  onChange={handleChange}
                  placeholder="React, FastAPI, PostgreSQL"
                  className="w-full border border-white/10 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full border border-white/10 rounded-lg px-4 py-2"
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveProject}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg"
              >
                {editingId ? "Save Changes" : "Add Project"}
              </button>

              <button
                onClick={resetForm}
                className="bg-slate-200 hover:bg-slate-300 px-5 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>

          </div>
        )}

        {projects.length === 0 ? (
          <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-8 text-center text-slate-400">
            No projects added yet.
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-[#0b1018] rounded-2xl border shadow-sm p-6"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold">
                    {project.name}
                  </h3>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      statusColors[project.status] || "bg-[#0b1018]/[0.06] text-slate-200"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                {project.description && (
                  <p className="text-slate-300 mb-2">
                    {project.description}
                  </p>
                )}

                {project.technology && (
                  <p className="text-sm text-slate-400 mb-4">
                    {project.technology}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => startEdit(project)}
                    className="text-sm px-4 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-cyan-400/10"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteProject(project.id)}
                    className="text-sm px-4 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}


/* Progress Page */
function ProgressPage({ student }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [skillGap, setSkillGap] = useState(null);
  const [skillGapLoading, setSkillGapLoading] = useState(false);
  const [learningRecommendations, setLearningRecommendations] = useState("");
  const [readinessAnalysis, setReadinessAnalysis] = useState("");

  useEffect(() => {
    const loadSkillGap = async () => {
      if (!student?.id) return;

      setSkillGapLoading(true);

      try {
        const response = await apiFetch(
          `${API_BASE}/students/${student.id}/skill-gap`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Failed to load skill gap"
          );
        }

        setSkillGap(data);
      } catch (error) {
        console.error("Skill gap error:", error);
      } finally {
        setSkillGapLoading(false);
      }
    };

    loadSkillGap();
  }, [student?.id]);

  useEffect(() => {
    const loadLearningRecommendations = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/students/${student.id}/learning-recommendations`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Failed to load learning recommendations"
          );
        }

        setLearningRecommendations(data.recommendations || "");
      } catch (error) {
        console.error("Learning recommendations error:", error);
        setLearningRecommendations("");
      }
    };

    loadLearningRecommendations();
  }, [student?.id]);

  useEffect(() => {
    const loadReadinessAnalysis = async () => {
      if (!student?.id) return;

      try {
        const response = await apiFetch(
          `${API_BASE}/students/${student.id}/readiness-analysis`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Failed to load readiness analysis"
          );
        }

        setReadinessAnalysis(data.analysis || "");
      } catch (error) {
        console.error("Readiness analysis error:", error);
        setReadinessAnalysis("");
      }
    };

    loadReadinessAnalysis();
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) return;

    apiFetch(`${API_BASE}/progress/${student.id}`)
      .then((res) => res.json())
      .then((data) => {
        setProgress(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Could not load progress:", error);
        setLoading(false);
      });
  }, [student]);

  if (loading) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-slate-400">
            Loading progress...
          </p>
        </div>
      </section>
    );
  }

  if (!progress) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-slate-400">
            Unable to load progress.
          </p>
        </div>
      </section>
    );
  }

  const getLevel = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Average";
    return "Needs Improvement";
  };

  return (
    <section className="p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div>
          <h2 className="text-2xl font-bold">
            📈 Progress
          </h2>

          <p className="text-slate-400 mt-1">
            Track your placement preparation progress.
          </p>
        </div>

        {/* Readiness Score */}
        <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6 text-center">

          <h3 className="text-lg font-bold">
            Placement Readiness
          </h3>

          <div className="text-5xl font-bold mt-4 text-cyan-300">
            {progress.readiness_score}%
          </div>

          <p className="mt-2 text-slate-400">
            {getLevel(progress.readiness_score)}
          </p>

        </div>

        {/* Skill Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          <ProgressCard title="Resume" score={progress.resume_score} />
          <ProgressCard title="Coding" score={progress.coding_score} />
          <ProgressCard title="Aptitude" score={progress.aptitude_score} />
          <ProgressCard title="Projects" score={progress.project_score} />
          <ProgressCard title="Interview" score={progress.interview_score} />

        </div>

        {/* Interview */}
        <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">

          <h3 className="text-lg font-bold">
            Interview Preparation
          </h3>

          <p className="mt-2 text-slate-300">
            {progress.interview_attempted} / {progress.interview_total} questions answered
          </p>

          <div className="w-full bg-[#0b1018]/10 rounded-full h-3 mt-4">
            <div
              className="bg-cyan-400 h-3 rounded-full"
              style={{
                width:
                  progress.interview_total > 0
                    ? `${Math.min(
                        (progress.interview_attempted /
                          progress.interview_total) *
                          100,
                        100
                      )}%`
                    : "0%",
              }}
            />
          </div>

        </div>

        {/* Projects */}
        <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">

          <h3 className="text-lg font-bold">
            Completed Projects
          </h3>

          <p className="text-3xl font-bold mt-3 text-cyan-300">
            {progress.completed_projects}
          </p>

          <p className="text-slate-400">
            Completed projects
          </p>

        </div>

      </div>

      {/* Skill Gap Analyzer */}
      <div className="rounded-2xl border bg-[#0b1018] p-6 shadow-sm">

          <div className="mb-5">
            <h2 className="text-xl font-bold">
              🧠 Skill Gap Analyzer
            </h2>

            <p className="text-sm text-slate-400">
              Skills required for your target role:
              {" "}
              {skillGap?.target_role || student?.target_role}
            </p>
          </div>

          {skillGapLoading ? (
            <p className="text-slate-400">
              Analyzing your skill gaps...
            </p>
          ) : skillGap ? (
            <>
              <div className="mb-5 grid grid-cols-3 gap-4">

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-400">
                    Required
                  </p>
                  <p className="text-2xl font-bold">
                    {skillGap.total_required}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-400">
                    Matched
                  </p>
                  <p className="text-2xl font-bold">
                    {skillGap.total_matched}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-slate-400">
                    Missing
                  </p>
                  <p className="text-2xl font-bold">
                    {skillGap.total_missing}
                  </p>
                </div>

              </div>

              {skillGap.matched_skills?.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-semibold">
                    ✅ Matched Skills
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {skillGap.matched_skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full bg-green-100 px-3 py-1 text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {skillGap.skill_gaps?.length > 0 && (
                <div>
                  <h3 className="font-semibold">
                    ⚠️ Skills to Improve
                  </h3>

                  <div className="mt-3 space-y-3">
                    {skillGap.skill_gaps.map((gap) => (
                      <div
                        key={gap.skill}
                        className="flex items-center justify-between rounded-xl border p-3"
                      >
                        <span className="font-medium">
                          {gap.skill}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                          {gap.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          ) : (
            <p className="text-slate-400">
              Skill gap information is not available yet.
            </p>
          )}

        {learningRecommendations && (
          <div className="mt-6 rounded-2xl border border-purple-400/20 bg-white/[0.03] p-6">

            <div className="flex items-center gap-3 mb-5">
              <div className="h-11 w-11 rounded-xl bg-purple-400/10 flex items-center justify-center">
                📚
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">
                  AI Learning Recommendations
                </h3>

                <p className="text-sm text-slate-400">
                  What you should learn next
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <p className="whitespace-pre-line text-slate-200 leading-7">
                {learningRecommendations}
              </p>
            </div>

          </div>
        )}

        {readinessAnalysis && (
          <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-white/[0.03] p-6">

            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-cyan-400/10 flex items-center justify-center">
                📈
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">
                  AI Readiness Analysis
                </h3>

                <p className="text-sm text-slate-400">
                  Understanding your current placement readiness
                </p>
              </div>
            </div>

            <p className="whitespace-pre-line text-slate-200 leading-7">
              {readinessAnalysis}
            </p>

          </div>
        )}

        </div>
    </section>
  );
}


/* Progress Card */
function ProgressCard({ title, score }) {
  return (
    <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-5">

      <h3 className="font-semibold">
        {title}
      </h3>

      <div className="text-3xl font-bold mt-3">
        {score}%
      </div>

      <div className="w-full bg-[#0b1018]/10 rounded-full h-2 mt-4">
        <div
          className="bg-cyan-400 h-2 rounded-full"
          style={{ width: `${score}%` }}
        />
      </div>

    </div>
  );
}


/* Career Roadmap Page */
function CareerRoadmapPage({ student }) {
  const [roadmap, setRoadmap] = useState([]);
  const [aiRoadmap, setAiRoadmap] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRoadmap = async () => {
      if (!student?.id) return;

      try {
        setLoading(true);

        const response = await apiFetch(
          `${API_BASE}/students/${student.id}/career-roadmap`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Could not load career roadmap"
          );
        }

        setRoadmap(data.roadmap || []);
        setAiRoadmap(data.ai_roadmap || "");
      } catch (error) {
        console.error("Failed to load career roadmap:", error);
        setRoadmap([]);
      } finally {
        setLoading(false);
      }
    };

    loadRoadmap();
  }, [student]);

  if (loading) {
    return (
      <div className="p-6 text-slate-400">
        Loading career roadmap...
      </div>
    );
  }

  return (
    <section className="p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div>
          <p className="text-sm font-medium text-cyan-300">
            AI CAREER ROADMAP
          </p>

          <h1 className="mt-1 text-3xl font-bold text-white">
            Your path to {student?.target_role}
          </h1>

          <p className="mt-2 text-slate-400">
            A personalized week-by-week preparation plan.
          </p>
        </div>

        {roadmap.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#0b1018]/[0.03] p-10 text-center text-slate-400">
            No roadmap available yet. Complete your resume analysis
            and preparation activities to generate one.
          </div>
        ) : (
          <div className="space-y-4">
            {roadmap.map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="flex items-start gap-4">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 font-bold text-cyan-300">
                    {index + 1}
                  </div>

                  <div className="flex-1">

                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                      {item.week}
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-white">
                      {item.focus}
                    </h2>

                    <div className="mt-4 space-y-2">
                      {item.tasks?.map((task, taskIndex) => (
                        <div
                          key={taskIndex}
                          className="rounded-lg bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
                        >
                          ✓ {task}
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {aiRoadmap && (
          <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-white/[0.03] p-6 shadow-[0_0_35px_rgba(34,211,238,0.08)]">

            <div className="flex items-center gap-3 mb-5">
              <div className="h-11 w-11 rounded-xl bg-cyan-400/10 flex items-center justify-center text-xl">
                🚀
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">
                  Real AI Career Roadmap
                </h3>

                <p className="text-sm text-slate-400">
                  Personalized roadmap based on your current placement profile
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <p className="whitespace-pre-line text-slate-200 leading-7">
                {aiRoadmap}
              </p>
            </div>

          </div>
        )}

      </div>
    </section>
  );
}


/* Project Suggestions Page */
function ProjectSuggestionsPage({ student }) {
  const [suggestions, setSuggestions] = useState([]);
  const [aiProjectSuggestions, setAiProjectSuggestions] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSuggestions = async () => {
      if (!student?.id) return;

      try {
        setLoading(true);

        const response = await apiFetch(
          `${API_BASE}/students/${student.id}/project-suggestions`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Could not load project suggestions"
          );
        }

        setSuggestions(data.suggestions || []);
        setAiProjectSuggestions(data.ai_project_suggestions || "");
      } catch (error) {
        console.error("Failed to load project suggestions:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    loadSuggestions();
  }, [student]);

  if (loading) {
    return (
      <div className="p-6 text-slate-400">
        Loading project suggestions...
      </div>
    );
  }

  return (
    <section className="p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div>
          <p className="text-sm font-medium text-cyan-300">
            AI PROJECT LAB
          </p>

          <h1 className="mt-1 text-3xl font-bold text-white">
            Projects for your career
          </h1>

          <p className="mt-2 text-slate-400">
            Project ideas based on your target role and skill gaps.
          </p>
        </div>

        {suggestions.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-[#0b1018]/[0.03] p-10 text-center text-slate-400">
            No project suggestions available yet.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">

            {suggestions.map((project, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-cyan-400/30"
              >

                <div className="flex items-start justify-between gap-4">

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                      Project {index + 1}
                    </p>

                    <h2 className="mt-2 text-xl font-bold text-white">
                      {project.title}
                    </h2>
                  </div>

                  <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                    AI Suggestion
                  </span>

                </div>

                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {project.reason}
                </p>

                {project.skills?.length > 0 && (
                  <div className="mt-5">

                    <p className="mb-2 text-sm font-semibold text-white">
                      Skills to practice
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {project.skills.map((skill, skillIndex) => (
                        <span
                          key={skillIndex}
                          className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs text-purple-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                  </div>
                )}

              </div>
            ))}

          </div>
        )}

        {aiProjectSuggestions && (
          <div className="mt-6 rounded-2xl border border-purple-400/20 bg-white/[0.03] p-6 shadow-[0_0_35px_rgba(168,85,247,0.08)]">

            <div className="flex items-center gap-3 mb-5">
              <div className="h-11 w-11 rounded-xl bg-purple-400/10 flex items-center justify-center text-xl">
                💡
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">
                  Real AI Project Suggestions
                </h3>

                <p className="text-sm text-slate-400">
                  Projects recommended from your target role and skill gaps
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <p className="whitespace-pre-line text-slate-200 leading-7">
                {aiProjectSuggestions}
              </p>
            </div>

          </div>
        )}

      </div>
    </section>
  );
}


/* Placement Chat Page */
function PlacementChatPage({ student }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: `Hi ${student?.name || ""}! I'm your PlacementPro AI Assistant. Ask me anything about your placement preparation.`
    }
  ]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    const text = message.trim();

    if (!text || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text
      }
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await apiFetch(
        `${API_BASE}/students/${student.id}/placement-chat`,
        {
          method: "POST",
          body: JSON.stringify({
            message: text
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not process that request"
        );
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.message
        }
      ]);
    } catch (error) {
      console.error("Chat error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, I couldn't process that request."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="p-4 sm:p-6">
      <div className="flex h-[calc(100vh-160px)] max-w-4xl mx-auto flex-col">

        <div className="mb-5">
          <p className="text-sm font-medium text-cyan-300">
            PLACEMENTPRO AI
          </p>

          <h1 className="mt-1 text-3xl font-bold text-white">
            AI Placement Assistant
          </h1>

          <p className="mt-2 text-slate-400">
            Ask questions about your placement preparation.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-5">

          {messages.map((item, index) => (
            <div
              key={index}
              className={`flex ${
                item.role === "user"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  item.role === "user"
                    ? "bg-cyan-400/10 text-cyan-100"
                    : "border border-white/10 bg-white/[0.04] text-slate-200"
                }`}
              >
                {item.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="text-sm text-slate-500">
              PlacementPro AI is thinking...
            </div>
          )}

        </div>

        <div className="mt-4 flex gap-3">

          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            placeholder="Ask about your placement preparation..."
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="rounded-xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
          >
            Send
          </button>

        </div>

      </div>
    </section>
  );
}


/* Profile Page */
function ProfilePage({ student, setStudent }) {
  const [form, setForm] = useState(student);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");

  // Keep the local form in sync whenever the student prop changes —
  // without this, `form` stays stuck at whatever `student` was on
  // ProfilePage's first mount (often null, since it loads async) and
  // never picks up the real data once the fetch resolves.
  useEffect(() => {
    setForm(student);
  }, [student]);

  if (!student) {
    return (
      <div className="p-4 sm:p-6">
        <p>Loading student profile...</p>
      </div>
    );
  }

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const saveProfile = async () => {
    try {
      const response = await apiFetch(
        `${API_BASE}/students/${student.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            degree: form.degree,
            branch: form.branch,
            cgpa: Number(form.cgpa),
            target_role: form.target_role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Unable to update profile.");
        return;
      }

      const updatedStudent = {
        ...form,
        cgpa: Number(form.cgpa),
      };

      setStudent(updatedStudent);
      setForm(updatedStudent);
      setEditing(false);
      setMessage("Profile updated successfully!");
    } catch (error) {
      console.error(error);
      setMessage("Unable to update profile.");
    }
  };

  const fields = [
    ["name", "Name"],
    ["email", "Email"],
    ["degree", "Degree"],
    ["branch", "Branch"],
    ["cgpa", "CGPA"],
    ["target_role", "Target Role"],
  ];

  return (
    <section className="p-4 sm:p-6">

      <div className="max-w-4xl mx-auto space-y-6">

        <div>
          <h2 className="text-2xl font-bold">
            Profile
          </h2>

          <p className="text-slate-400 mt-1">
            Manage your academic and placement information.
          </p>
        </div>

        {message && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
            {message}
          </div>
        )}

        <div className="bg-[#0b1018] rounded-2xl border shadow-sm p-6">

          <div className="flex justify-between items-center mb-6">

            <h3 className="text-lg font-bold">
              Student Information
            </h3>

            {!editing && (
              <button
                onClick={() => {
                  setEditing(true);
                  setMessage("");
                }}
                className="bg-cyan-400 hover:bg-cyan-300 text-white px-5 py-2 rounded-lg"
              >
                Edit Profile
              </button>
            )}

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {fields.map(([key, label]) => (

              <div key={key}>

                <label className="block text-sm font-medium text-slate-300 mb-1">
                  {label}
                </label>

                {editing ? (
                  <input
                    name={key}
                    value={form[key] ?? ""}
                    onChange={handleChange}
                    type={key === "cgpa" ? "number" : "text"}
                    step={key === "cgpa" ? "0.01" : undefined}
                    className="w-full border border-white/10 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="bg-[#05070d] rounded-lg px-4 py-2">
                    {student[key]}
                  </div>
                )}

              </div>

            ))}

          </div>

          {editing && (
            <div className="flex gap-3 mt-6">

              <button
                onClick={saveProfile}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg"
              >
                Save Changes
              </button>

              <button
                onClick={() => {
                  setForm(student);
                  setEditing(false);
                  setMessage("");
                }}
                className="bg-slate-200 hover:bg-slate-300 px-5 py-2 rounded-lg"
              >
                Cancel
              </button>

            </div>
          )}

        </div>

      </div>

    </section>
  );
}



/* Stat Card */
function StatCard({ title, value, icon, subtitle }) {
  return (
    <div className="bg-[#0b1018] rounded-2xl p-5 border shadow-sm hover:shadow-md transition">

      <div className="flex justify-between items-start">

        <div>
          <p className="text-sm text-slate-400">
            {title}
          </p>

          <p className="text-3xl font-bold mt-2">
            {value}
          </p>
        </div>

        <span className="text-2xl">
          {icon}
        </span>

      </div>

      <p className="text-xs text-slate-400 mt-3">
        {subtitle}
      </p>

    </div>
  );
}


/* Task */
function Task({ text, completed = false }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#05070d]">

      <div
        className={`w-5 h-5 rounded border flex items-center justify-center ${
          completed
            ? "bg-cyan-400 border-blue-600 text-white"
            : "border-white/10"
        }`}
      >
        {completed && "✓"}
      </div>

      <span
        className={
          completed
            ? "text-slate-400 line-through"
            : "text-slate-200"
        }
      >
        {text}
      </span>

    </div>
  );
}


/* Progress */
function Progress({ name, value }) {
  return (
    <div className="mb-4">

      <div className="flex justify-between text-sm mb-1">
        <span>{name}</span>
        <span className="font-semibold">{value}</span>
      </div>

      <div className="h-2 bg-slate-100 rounded-full">
        <div
          className="h-2 bg-cyan-400 rounded-full"
          style={{ width: value }}
        ></div>
      </div>

    </div>
  );
}

export default App;