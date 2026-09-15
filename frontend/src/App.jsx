import { useState, useEffect } from "react";

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

function App() {
  const [active, setActive] = useState("Dashboard");
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

  const menu = [
    "Dashboard",
    "Profile",
    "Resume",
    "Coding",
    "Aptitude",
    "Interview",
    "Companies",
    "Projects",
    "Progress",
  ];

  // Checking localStorage for a session token before deciding what to render.
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Loading PlacementPro...</p>
      </div>
    );
  }

  // No valid session — show the login/register screen instead of the app.
  if (!token || !student) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex">

      {/* Sidebar */}
      {/* FIX: removed "hidden md:block" — that class was hiding the entire
          sidebar (including the Profile button) on any viewport narrower
          than Tailwind's md breakpoint (768px). That was the actual cause
          of "Profile" being unclickable/invisible. Sidebar is now always
          visible. Kept "relative" so the Settings button still anchors here. */}
      <aside className="w-64 bg-slate-900 text-white min-h-screen p-5 relative">

        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Placement<span className="text-blue-400">Pro</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            AI Placement Coach
          </p>
        </div>

        <nav className="space-y-2">
          {menu.map((item) => (
            <button
              key={item}
              onClick={() => {
                setActive(item);
                if (item === "Profile") {
                  setShowProfile(true);
                } else {
                  setShowProfile(false);
                }
              }}
              className={`w-full text-left px-4 py-3 rounded-lg transition ${
                active === item
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-6 left-5 right-5 space-y-1">
          <button className="text-slate-400 hover:text-white transition">
            ⚙ Settings
          </button>

          <button
            onClick={handleLogout}
            className="block text-slate-400 hover:text-white transition"
          >
            ⏻ Logout
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 min-w-0">

        {/* Navbar */}
        <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-500">Welcome back 👋</p>
            <h2 className="text-xl font-bold">Good Morning!</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="font-semibold">
                {loading ? "Loading..." : student?.name || "API NOT CONNECTED"}
              </p>
              <p className="text-xs text-slate-500">
                {student?.target_role || "Software Developer"}
              </p>
            </div>

            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
              {student?.name?.charAt(0).toUpperCase() || "S"}
            </div>
          </div>
        </header>

        {active === "Profile" ? (
          <ProfilePage
            student={student}
            setStudent={setStudent}
          />
        ) : active === "Resume" ? (
          <ResumePage student={student} />
        ) : active === "Coding" ? (
          <CodingPage student={student} />
        ) : active === "Aptitude" ? (
          <AptitudePage student={student} />
        ) : active === "Interview" ? (
          <InterviewPage student={student} />
        ) : active === "Companies" ? (
          <CompaniesPage />
        ) : active === "Projects" ? (
          <ProjectsPage student={student} />
        ) : active === "Progress" ? (
          <ProgressPage student={student} />
        ) : (
          /* Dashboard */
          <section className="p-4 sm:p-6">

            {loading ? (
              <div className="text-slate-500">
                Loading dashboard...
              </div>
            ) : (
              <>

            {/* Visible connection status instead of a raw debug dump */}
            {apiError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 m-4 rounded-lg text-sm">
                Couldn't load student data: {apiError}
              </div>
            )}

            {student && (
              <div className="bg-white rounded-2xl p-6 mb-6 border shadow-sm">
                <h3 className="text-lg font-bold mb-4">
                  Student Profile
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                  <div>
                    <p className="text-sm text-slate-500">Name</p>
                    <p className="font-semibold">{student.name}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">Degree</p>
                    <p className="font-semibold">{student.degree}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">Branch</p>
                    <p className="font-semibold">{student.branch}</p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-500">CGPA</p>
                    <p className="font-semibold">{student.cgpa}</p>
                  </div>

                </div>
              </div>
            )}

            {/* Welcome Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-6 mb-6">
              <h2 className="text-2xl font-bold mb-2">
                Your Placement Journey 🚀
              </h2>

              <p className="text-blue-100 mb-5">
                Keep learning, keep practicing, and get closer to your dream job.
              </p>

              <div className="flex items-center gap-5">
                <div>
                  <p className="text-sm text-blue-100">
                    Placement Readiness
                  </p>
                  <p className="text-4xl font-bold">72%</p>
                </div>

                <div className="flex-1 max-w-md">
                  <div className="h-3 bg-blue-400/40 rounded-full">
                    <div className="h-3 bg-white rounded-full w-[72%]"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">

              <StatCard
                title="Coding"
                value={`${codingScore}%`}
                icon="💻"
                subtitle="127 problems solved"
              />

              <StatCard
                title="Aptitude"
                value={`${aptitudeScore}%`}
                icon="🧮"
                subtitle="16 tests completed"
              />

              <StatCard
                title="Resume"
                value={`${resumeScore}%`}
                icon="📄"
                subtitle={resumeScore > 0 ? "Good profile" : "Not analyzed yet"}
              />

              <StatCard
                title="Projects"
                value={`${projectScore}%`}
                icon="🏗️"
                subtitle="3 projects added"
              />

            </div>

            {/* Lower Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Today's Tasks */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border">

                <div className="flex justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-bold">
                      Today's Tasks
                    </h3>
                    <p className="text-sm text-slate-500">
                      Complete these tasks to improve your score.
                    </p>
                  </div>

                  <span className="text-blue-600 font-semibold">
                    2/4
                  </span>
                </div>

                <div className="space-y-3">

                  <Task text="Solve 3 coding problems" completed />

                  <Task text="Complete SQL aptitude quiz" />

                  <Task text="Practice 2 HR interview questions" />

                  <Task text="Review your resume" completed />

                </div>
              </div>

              {/* Quick Progress */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border">

                <h3 className="text-lg font-bold mb-5">
                  Skill Progress
                </h3>

                <Progress name="Python" value="80%" />
                <Progress name="SQL" value="62%" />
                <Progress name="DSA" value="58%" />
                <Progress name="DBMS" value="70%" />
                <Progress name="Communication" value="65%" />

              </div>

            </div>

            {/* Next Goal */}
            <div className="mt-6 bg-white rounded-2xl p-6 border shadow-sm">

              <h3 className="text-lg font-bold mb-2">
                🎯 Your Next Goal
              </h3>

              <p className="text-slate-600">
                Improve your DSA and SQL skills to increase your
                placement readiness.
              </p>

              <button className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg">
                Start Learning
              </button>

            </div>

              </>
            )}

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            Placement<span className="text-blue-600">Pro</span>
          </h1>
          <p className="text-slate-500 mt-1">
            AI Placement Coach
          </p>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-6">

          <div className="flex mb-6 rounded-lg bg-slate-100 p-1">
            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${
                mode === "login"
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-slate-500"
              }`}
            >
              Login
            </button>

            <button
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${
                mode === "register"
                  ? "bg-white shadow-sm text-blue-600"
                  : "text-slate-500"
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={submitLogin} className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={loginForm.email}
                  onChange={handleLoginChange}
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-semibold disabled:opacity-50 transition"
              >
                {submitting ? "Logging in..." : "Login"}
              </button>

            </form>
          ) : (
            <form onSubmit={submitRegister} className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={registerForm.name}
                  onChange={handleRegisterChange}
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={registerForm.email}
                  onChange={handleRegisterChange}
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={registerForm.password}
                  onChange={handleRegisterChange}
                  required
                  minLength={6}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Degree
                  </label>
                  <input
                    type="text"
                    name="degree"
                    value={registerForm.degree}
                    onChange={handleRegisterChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Branch
                  </label>
                  <input
                    type="text"
                    name="branch"
                    value={registerForm.branch}
                    onChange={handleRegisterChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    CGPA
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="cgpa"
                    value={registerForm.cgpa}
                    onChange={handleRegisterChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Target Role
                  </label>
                  <input
                    type="text"
                    name="target_role"
                    value={registerForm.target_role}
                    onChange={handleRegisterChange}
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-semibold disabled:opacity-50 transition"
              >
                {submitting ? "Creating account..." : "Create Account"}
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

          <p className="text-slate-500 mt-1">
            Upload your resume and get an AI-powered placement analysis.
          </p>
        </div>


        {/* Upload Card */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">

          <h3 className="text-lg font-bold mb-2">
            Upload Your Resume
          </h3>

          <p className="text-sm text-slate-500 mb-5">
            Supported formats: PDF and DOCX
          </p>

          <input
            type="file"
            accept=".pdf,.docx"
            onChange={(e) => {
              setFile(e.target.files[0]);
              setResult(null);
            }}
            className="block w-full border border-slate-300 rounded-lg p-3"
          />

          {file && (
            <p className="text-sm text-green-600 mt-3">
              Selected: {file.name}
            </p>
          )}

          <button
            onClick={analyzeResume}
            disabled={loading}
            className="mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-lg font-semibold"
          >
            {loading ? "Analyzing..." : "Analyze Resume"}
          </button>

        </div>


        {/* Results */}
        {result && (
          <div className="space-y-6">

            {/* Overall Score */}
            <div className="bg-white rounded-2xl border shadow-sm p-6">

              <h3 className="text-lg font-bold mb-5">
                Resume Score
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-6">

                <div className="w-32 h-32 rounded-full bg-blue-50 border-8 border-blue-600 flex items-center justify-center">

                  <div className="text-center">

                    <p className="text-4xl font-bold text-blue-600">
                      {result.resume_score}
                    </p>

                    <p className="text-xs text-slate-500">
                      / 100
                    </p>

                  </div>

                </div>


                <div>

                  <p className="font-semibold text-xl">

                    {result.resume_score >= 80
                      ? "Excellent Resume! 🎉"
                      : result.resume_score >= 60
                      ? "Good Resume 👍"
                      : result.resume_score >= 40
                      ? "Needs Improvement ⚠️"
                      : "Resume Needs Major Improvement ❗"}

                  </p>

                  <p className="text-sm text-slate-500 mt-2">
                    Your score is calculated using skills, education,
                    projects, experience, certifications and resume
                    completeness.
                  </p>

                </div>

              </div>

            </div>


            {/* Score Breakdown */}
            <div className="bg-white rounded-2xl border shadow-sm p-6">

              <div className="mb-5">

                <h3 className="text-lg font-bold">
                  📊 Score Breakdown
                </h3>

                <p className="text-sm text-slate-500 mt-1">
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
                      className="border rounded-xl p-4"
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

                        <span className="font-bold text-blue-600">
                          {item.score}/{item.max}
                        </span>

                      </div>


                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">

                        <div
                          className="h-3 bg-blue-600 rounded-full transition-all duration-700"
                          style={{
                            width: `${percentage}%`,
                          }}
                        ></div>

                      </div>


                      <p className="text-xs text-slate-500 mt-2">
                        {percentage}% of available points
                      </p>

                    </div>
                  );

                })}

              </div>

            </div>


            {/* Strengths and Missing Skills */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


              {/* Strengths */}
              <div className="bg-white rounded-2xl border shadow-sm p-6">

                <h3 className="text-lg font-bold mb-4">
                  ✅ Strengths
                </h3>

                {result.strengths?.length > 0 ? (

                  <div className="space-y-2">

                    {result.strengths.map((strength, index) => (

                      <div
                        key={index}
                        className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm font-medium"
                      >
                        ✓ {strength}
                      </div>

                    ))}

                  </div>

                ) : (

                  <p className="text-slate-500">
                    No major strengths detected yet.
                  </p>

                )}

              </div>


              {/* Missing Skills */}
              <div className="bg-white rounded-2xl border shadow-sm p-6">

                <h3 className="text-lg font-bold mb-4">
                  ⚠️ Missing Skills
                </h3>

                {result.missing_skills?.length > 0 ? (

                  <div className="flex flex-wrap gap-2">

                    {result.missing_skills.map((skill) => (

                      <span
                        key={skill}
                        className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm font-medium"
                      >
                        {skill}
                      </span>

                    ))}

                  </div>

                ) : (

                  <p className="text-green-600">
                    Great! No missing skills detected.
                  </p>

                )}

              </div>

            </div>


            {/* Suggestions */}
            <div className="bg-white rounded-2xl border shadow-sm p-6">

              <h3 className="text-lg font-bold mb-4">
                💡 Improvement Suggestions
              </h3>

              {result.suggestions?.length > 0 ? (

                <div className="space-y-3">

                  {result.suggestions.map((suggestion, index) => (

                    <div
                      key={index}
                      className="bg-blue-50 rounded-lg p-4 text-slate-700"
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
              <div className="bg-white rounded-2xl border shadow-sm p-6">
                <h3 className="text-lg font-bold mb-2">
                  📈 Resume Analysis History
                </h3>

                <p className="text-sm text-slate-500 mb-5">
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

                        <p className="text-sm text-slate-500">
                          Target Role: {item.target_role}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-2xl font-bold text-blue-600">
                          {item.resume_score}/100
                        </p>

                        <p className="text-xs text-slate-500">
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
            <p className="mt-1 text-sm text-blue-600">
              Checking your skills and placement improvement areas.
            </p>
          </div>
        )}

        {aiRecommendations && !aiLoading && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">
              🤖 AI Placement Recommendations
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Target Role:{" "}
              <span className="font-semibold">
                {aiRecommendations.target_role}
              </span>
            </p>

            <div className="mt-5">
              <h3 className="font-semibold text-green-700">
                ✅ Detected Skills
              </h3>

              <div className="mt-2 flex flex-wrap gap-2">
                {aiRecommendations.detected_skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-semibold text-red-700">
                ⚠️ Missing Skills
              </h3>

              <div className="mt-2 flex flex-wrap gap-2">
                {aiRecommendations.missing_skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-semibold text-blue-700">
                🚀 Improvement Recommendations
              </h3>

              <ul className="mt-2 space-y-2">
                {aiRecommendations.recommendations.map(
                  (recommendation, index) => (
                    <li
                      key={index}
                      className="rounded-lg bg-blue-50 p-3 text-sm text-gray-700"
                    >
                      {recommendation}
                    </li>
                  )
                )}
              </ul>
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
          <p className="text-slate-500">
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
          <div className="bg-white rounded-2xl border shadow-sm p-6">
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

          <p className="text-slate-500 mt-1">
            Practice coding and improve your placement readiness.
          </p>
        </div>

        {isCodingTestCompleted ? (
          <div className="inline-flex items-center px-4 py-2 mb-6 rounded-full bg-green-100 text-green-700 font-semibold">
            ✅ Coding Test Completed
          </div>
        ) : (
          <div className="inline-flex items-center px-4 py-2 mb-6 rounded-full bg-blue-100 text-blue-700 font-semibold">
            📝 Test In Progress
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">

          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              Total Questions
            </p>

            <p className="text-3xl font-bold text-purple-600 mt-1">
              {stats.total_questions}
            </p>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              Attempted
            </p>

            <p className="text-3xl font-bold text-blue-600 mt-1">
              {stats.attempted}
            </p>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              Correct
            </p>

            <p className="text-3xl font-bold text-green-600 mt-1">
              {stats.correct}
            </p>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              Accuracy
            </p>

            <p className="text-3xl font-bold text-orange-600 mt-1">
              {stats.accuracy}%
            </p>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              Coding Score
            </p>

            <p className="text-3xl font-bold text-blue-600 mt-1">
              {stats.coding_score}%
            </p>
          </div>

        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">

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
                    ? "bg-blue-600 text-white"
                    : codingResults[String(q.id)] === true
                    ? "bg-green-500 text-white"
                    : codingResults[String(q.id)] === false
                    ? "bg-red-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm">

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-blue-600"></span>
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
              <span className="w-4 h-4 rounded bg-gray-200"></span>
              Not Attempted
            </div>

          </div>

        </div>

        {currentIndex < questions.length ? (
          <div className="bg-white rounded-2xl border shadow-sm p-6">

            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-semibold text-blue-600">
                Question {currentIndex + 1}
              </span>

              <span className="text-sm text-slate-500">
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

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`
                  }}
                ></div>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
                {question.category}
              </span>

              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
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
                      : "border-gray-200"
                  } ${
                    result || attemptedQuestionIds.includes(question.id)
                      ? "cursor-not-allowed opacity-70"
                      : "hover:bg-gray-50"
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
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2 rounded-lg bg-gray-200 disabled:opacity-50"
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
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                Next →
              </button>
            </div>

          </div>
        ) : (
          <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
            <h3 className="text-2xl font-bold">
              🏆 Final Coding Result
            </h3>

            <p className="text-4xl font-bold text-blue-600 mt-5">
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
                <p className="text-xs text-slate-500">
                  Attempted
                </p>
              </div>

              <div>
                <p className="text-xl font-bold text-green-600">
                  {stats.correct}
                </p>
                <p className="text-xs text-slate-500">
                  Correct
                </p>
              </div>

              <div>
                <p className="text-xl font-bold text-orange-600">
                  {stats.accuracy}%
                </p>
                <p className="text-xs text-slate-500">
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
          <p className="text-slate-500">
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
          <div className="bg-white rounded-2xl border shadow-sm p-6">
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

          <p className="text-slate-500 mt-1">
            Sharpen your quantitative and logical reasoning skills.
          </p>
        </div>

        {isAptitudeTestCompleted ? (
          <div className="inline-flex items-center px-4 py-2 mb-6 rounded-full bg-green-100 text-green-700 font-semibold">
            ✅ Aptitude Test Completed
          </div>
        ) : (
          <div className="inline-flex items-center px-4 py-2 mb-6 rounded-full bg-blue-100 text-blue-700 font-semibold">
            📝 Test In Progress
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">

          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              Total Questions
            </p>

            <p className="text-3xl font-bold text-purple-600 mt-1">
              {stats.total_questions}
            </p>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              Attempted
            </p>

            <p className="text-3xl font-bold text-blue-600 mt-1">
              {stats.attempted}
            </p>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              Correct
            </p>

            <p className="text-3xl font-bold text-green-600 mt-1">
              {stats.correct}
            </p>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              Accuracy
            </p>

            <p className="text-3xl font-bold text-orange-600 mt-1">
              {stats.accuracy}%
            </p>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <p className="text-sm text-slate-500">
              Aptitude Score
            </p>

            <p className="text-3xl font-bold text-blue-600 mt-1">
              {stats.aptitude_score}%
            </p>
          </div>

        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">

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
                    ? "bg-blue-600 text-white"
                    : aptitudeResults[String(q.id)] === true
                    ? "bg-green-500 text-white"
                    : aptitudeResults[String(q.id)] === false
                    ? "bg-red-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div
              className="bg-blue-600 h-3 rounded-full"
              style={{
                width: `${
                  stats.total_questions > 0
                    ? (stats.attempted / stats.total_questions) * 100
                    : 0
                }%`,
              }}
            ></div>
          </div>

          <p className="text-sm text-slate-500 mb-4">
            {stats.attempted} of {stats.total_questions} questions attempted
          </p>

          <div className="flex flex-wrap gap-4 text-sm">

            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-blue-600"></span>
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
              <span className="w-4 h-4 rounded bg-gray-200"></span>
              Not Attempted
            </div>

          </div>

        </div>

        {currentIndex < questions.length ? (
          <div className="bg-white rounded-2xl border shadow-sm p-6">

            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-semibold text-blue-600">
                Question {currentIndex + 1}
              </span>

              <span className="text-sm text-slate-500">
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

              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${((currentIndex + 1) / questions.length) * 100}%`
                  }}
                ></div>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
                {question.category}
              </span>

              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
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
                      : "border-gray-200"
                  } ${
                    result || attemptedQuestionIds.includes(question.id)
                      ? "cursor-not-allowed opacity-70"
                      : "hover:bg-gray-50"
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
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="px-4 py-2 rounded-lg bg-gray-200 disabled:opacity-50"
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
                className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                Next →
              </button>
            </div>

          </div>
        ) : (
          <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
            <h3 className="text-2xl font-bold">
              🏆 Final Aptitude Result
            </h3>

            <p className="text-4xl font-bold text-blue-600 mt-5">
              {stats.aptitude_score}%
            </p>

            <div className="text-2xl font-bold mb-4">
              {getAptitudePerformance(stats.aptitude_score)}
            </div>

            <p className="text-slate-500 mb-2">
              {stats.correct} correct out of {stats.total_questions}
            </p>

            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mt-2">
              <div>
                <p className="text-xl font-bold">
                  {stats.attempted}/{stats.total_questions}
                </p>
                <p className="text-xs text-slate-500">
                  Attempted
                </p>
              </div>

              <div>
                <p className="text-xl font-bold text-green-600">
                  {stats.correct}
                </p>
                <p className="text-xs text-slate-500">
                  Correct
                </p>
              </div>

              <div>
                <p className="text-xl font-bold text-orange-600">
                  {stats.accuracy}%
                </p>
                <p className="text-xs text-slate-500">
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

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await apiFetch(
          `${API_BASE}/interview/questions`
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
  }, []);

  const submitAnswer = async () => {
    if (!answer.trim()) return;

    if (!student?.id) {
      alert("Student profile not found.");
      return;
    }

    const question = questions[currentIndex];

    try {
      const response = await apiFetch(
        `${API_BASE}/interview/${student.id}/submit?question_id=${question.id}&answer=${encodeURIComponent(answer)}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Unable to submit answer");
        return;
      }

      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert("Could not connect to backend.");
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer("");
      setSubmitted(false);
    }
  };

  const previousQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setAnswer("");
      setSubmitted(false);
    }
  };

  if (loading) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-500">
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
          <div className="bg-white rounded-2xl border shadow-sm p-6">
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

          <p className="text-slate-500 mt-1">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-6">

          <div className="flex gap-2 mb-4">
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
              {question.category}
            </span>

            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
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
            className="w-full min-h-40 border border-slate-300 rounded-lg p-4 disabled:opacity-70 disabled:cursor-not-allowed"
          />

          <div className="flex gap-3 mt-5">

            <button
              onClick={submitAnswer}
              disabled={!answer.trim() || submitted}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitted ? "Answer Submitted" : "Submit Answer"}
            </button>

            <button
              onClick={previousQuestion}
              disabled={currentIndex === 0}
              className="px-5 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
            >
              ← Previous
            </button>

            {currentIndex < questions.length - 1 && (
              <button
                onClick={nextQuestion}
                disabled={!submitted}
                className="px-5 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
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

          {submitted && currentIndex === questions.length - 1 && (
            <div className="mt-4 bg-blue-50 text-blue-700 rounded-xl p-4 font-semibold">
              🎉 You've answered all interview questions!
            </div>
          )}

        </div>

      </div>
    </section>
  );
}


/* Companies Page */
function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

  if (loading) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-slate-500">
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

          <p className="text-slate-500 mt-1">
            Explore companies that hire for your target role.
          </p>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company, role, or skill..."
          className="w-full border border-slate-300 rounded-lg px-4 py-3 mb-6"
        />

        {filteredCompanies.length === 0 ? (
          <div className="bg-white rounded-2xl border shadow-sm p-6 text-center text-slate-500">
            No companies match your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="bg-white rounded-2xl border shadow-sm p-6"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-bold">
                    {company.name}
                  </h3>

                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                    {company.package}
                  </span>
                </div>

                <p className="text-slate-600 font-medium mb-3">
                  {company.role}
                </p>

                <div className="space-y-2 text-sm">
                  <p className="text-slate-500">
                    <span className="font-semibold text-slate-700">
                      Eligibility:
                    </span>{" "}
                    {company.eligibility}
                  </p>

                  <p className="text-slate-500">
                    <span className="font-semibold text-slate-700">
                      Skills:
                    </span>{" "}
                    {company.skills}
                  </p>
                </div>
              </div>
            ))}
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
    "Not Started": "bg-gray-100 text-gray-700",
    "In Progress": "bg-blue-100 text-blue-700",
    "Completed": "bg-green-100 text-green-700",
  };

  if (loading) {
    return (
      <section className="p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-slate-500">
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

            <p className="text-slate-500 mt-1">
              Track the projects you're building for placements.
            </p>
          </div>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold"
            >
              + Add Project
            </button>
          )}
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">

            <h3 className="text-lg font-bold mb-4">
              {editingId ? "Edit Project" : "New Project"}
            </h3>

            <div className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Project Name
                </label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  className="w-full min-h-24 border border-slate-300 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Technologies
                </label>
                <input
                  name="technology"
                  value={form.technology}
                  onChange={handleChange}
                  placeholder="React, FastAPI, PostgreSQL"
                  className="w-full border border-slate-300 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2"
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
          <div className="bg-white rounded-2xl border shadow-sm p-8 text-center text-slate-500">
            No projects added yet.
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-2xl border shadow-sm p-6"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold">
                    {project.name}
                  </h3>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      statusColors[project.status] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>

                {project.description && (
                  <p className="text-slate-600 mb-2">
                    {project.description}
                  </p>
                )}

                {project.technology && (
                  <p className="text-sm text-slate-500 mb-4">
                    {project.technology}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => startEdit(project)}
                    className="text-sm px-4 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
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
          <p className="text-slate-500">
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
          <p className="text-slate-500">
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

          <p className="text-slate-500 mt-1">
            Track your placement preparation progress.
          </p>
        </div>

        {/* Readiness Score */}
        <div className="bg-white rounded-2xl border shadow-sm p-6 text-center">

          <h3 className="text-lg font-bold">
            Placement Readiness
          </h3>

          <div className="text-5xl font-bold mt-4 text-blue-600">
            {progress.readiness_score}%
          </div>

          <p className="mt-2 text-slate-500">
            {getLevel(progress.readiness_score)}
          </p>

        </div>

        {/* Skill Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          <ProgressCard title="Resume" score={progress.resume_score} />
          <ProgressCard title="Coding" score={progress.coding_score} />
          <ProgressCard title="Aptitude" score={progress.aptitude_score} />
          <ProgressCard title="Projects" score={progress.project_score} />

        </div>

        {/* Interview */}
        <div className="bg-white rounded-2xl border shadow-sm p-6">

          <h3 className="text-lg font-bold">
            Interview Preparation
          </h3>

          <p className="mt-2 text-slate-600">
            {progress.interview_attempted} / {progress.interview_total} questions answered
          </p>

          <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
            <div
              className="bg-blue-600 h-3 rounded-full"
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
        <div className="bg-white rounded-2xl border shadow-sm p-6">

          <h3 className="text-lg font-bold">
            Completed Projects
          </h3>

          <p className="text-3xl font-bold mt-3 text-blue-600">
            {progress.completed_projects}
          </p>

          <p className="text-slate-500">
            Completed projects
          </p>

        </div>

      </div>
    </section>
  );
}


/* Progress Card */
function ProgressCard({ title, score }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5">

      <h3 className="font-semibold">
        {title}
      </h3>

      <div className="text-3xl font-bold mt-3">
        {score}%
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
        <div
          className="bg-blue-600 h-2 rounded-full"
          style={{ width: `${score}%` }}
        />
      </div>

    </div>
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

          <p className="text-slate-500 mt-1">
            Manage your academic and placement information.
          </p>
        </div>

        {message && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
            {message}
          </div>
        )}

        <div className="bg-white rounded-2xl border shadow-sm p-6">

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
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg"
              >
                Edit Profile
              </button>
            )}

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {fields.map(([key, label]) => (

              <div key={key}>

                <label className="block text-sm font-medium text-slate-600 mb-1">
                  {label}
                </label>

                {editing ? (
                  <input
                    name={key}
                    value={form[key] ?? ""}
                    onChange={handleChange}
                    type={key === "cgpa" ? "number" : "text"}
                    step={key === "cgpa" ? "0.01" : undefined}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="bg-slate-50 rounded-lg px-4 py-2">
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
    <div className="bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition">

      <div className="flex justify-between items-start">

        <div>
          <p className="text-sm text-slate-500">
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

      <p className="text-xs text-slate-500 mt-3">
        {subtitle}
      </p>

    </div>
  );
}


/* Task */
function Task({ text, completed = false }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50">

      <div
        className={`w-5 h-5 rounded border flex items-center justify-center ${
          completed
            ? "bg-blue-600 border-blue-600 text-white"
            : "border-slate-300"
        }`}
      >
        {completed && "✓"}
      </div>

      <span
        className={
          completed
            ? "text-slate-400 line-through"
            : "text-slate-700"
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
          className="h-2 bg-blue-600 rounded-full"
          style={{ width: value }}
        ></div>
      </div>

    </div>
  );
}

export default App;