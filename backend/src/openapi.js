/**
 * OpenAPI 3.0 spec for the FitGuard API.
 * UI: GET /api-docs   |   Raw JSON: GET /openapi.json
 */
const bearer = [{ bearerAuth: [] }];

const errRef = { schema: { $ref: "#/components/schemas/Error" } };
const errors = {
  400: { description: "Validation error", content: { "application/json": errRef } },
  401: { description: "Unauthorized", content: { "application/json": errRef } },
  403: { description: "Forbidden", content: { "application/json": errRef } },
  404: { description: "Not found", content: { "application/json": errRef } },
  409: { description: "Conflict", content: { "application/json": errRef } },
  429: { description: "Rate limited", content: { "application/json": errRef } },
};

// Builds a path operation compactly.
function op({ tag, summary, auth = false, params = [], body, example, responses, errs = [400, 401, 403, 404] }) {
  const operation = {
    tags: [tag],
    summary,
    responses: {
      ...(responses ?? { 200: { description: "OK" } }),
      ...Object.fromEntries(errs.map((c) => [c, errors[c]])),
    },
  };
  if (auth) operation.security = bearer;
  if (params.length) operation.parameters = params;
  if (body || example) {
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: body ?? { type: "object" }, ...(example ? { example } : {}) } },
    };
  }
  return operation;
}

const q = (name, description, extra = {}) => ({ name, in: "query", required: false, schema: { type: "string", ...extra }, description });
const p = (name, description) => ({ name, in: "path", required: true, schema: { type: "string" }, description });

const created = (description = "Created") => ({ 201: { description } });
const okR = (description = "OK") => ({ 200: { description } });

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "FitGuard API",
    version: "1.0.0",
    description:
      "AI-assisted fitness & injury-prevention platform. Base path: `/api`. " +
      "Auth: register (email+password) → verify email → login → onboarding (auto-generates an AI plan). " +
      "The phone identifies exercises by `trackedKey` and posts only raw rep/mistake events; " +
      "the backend owns all derived scoring (accuracy, injury risk).",
  },
  servers: [{ url: "/", description: "This server" }],
  tags: [
    { name: "Health" },
    { name: "Auth", description: "Register, verify, JWT access+refresh, password reset" },
    { name: "Users", description: "Profile, onboarding, AI plan" },
    { name: "Plans", description: "Active plan + coach plan authoring" },
    { name: "Exercises", description: "Catalog + on-device CV config" },
    { name: "Workouts", description: "Session submission + history" },
    { name: "Progress", description: "Summary, injury risk, trends" },
    { name: "Coaches", description: "Directory, applications, profile, subscribers" },
    { name: "Subscriptions", description: "Monthly coach subscriptions (mock billing)" },
    { name: "Notifications", description: "In-app notifications" },
    { name: "Media", description: "Uploads (profile, certs, transformations)" },
    { name: "Admin", description: "Users, coach applications, mistake taxonomy" },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Invalid input" },
            },
          },
        },
      },
    },
  },
  paths: {
    "/api/health": { get: op({ tag: "Health", summary: "Liveness", errs: [] }) },

    "/api/auth/register": {
      post: op({
        tag: "Auth",
        summary: "Register (email + password only)",
        example: { email: "user@example.com", password: "password123" },
        responses: created("User created; verification email sent"),
        errs: [400, 409, 429],
      }),
    },
    "/api/auth/login": {
      post: op({
        tag: "Auth",
        summary: "Login → accessToken + refreshToken",
        example: { email: "user@example.com", password: "password123" },
        responses: okR("Returns accessToken, refreshToken, user"),
        errs: [400, 401, 403, 429],
      }),
    },
    "/api/auth/refresh": {
      post: op({
        tag: "Auth",
        summary: "Rotate tokens",
        example: { refreshToken: "<refresh token>" },
        errs: [400, 401, 429],
      }),
    },
    "/api/auth/logout": {
      post: op({ tag: "Auth", summary: "Revoke refresh token", auth: true, errs: [401] }),
    },
    "/api/auth/forgot-password": {
      post: op({ tag: "Auth", summary: "Send reset email (no enumeration)", example: { email: "user@example.com" }, errs: [400, 429] }),
    },
    "/api/auth/reset-password": {
      get: op({ tag: "Auth", summary: "Reset password HTML page", params: [q("token", "Reset token")], errs: [400] }),
      post: op({ tag: "Auth", summary: "Reset password", example: { token: "<token>", newPassword: "newpassword123" }, errs: [400, 429] }),
    },
    "/api/auth/verify-email": {
      get: op({ tag: "Auth", summary: "Verify email", params: [q("token", "Verification token")], errs: [400] }),
    },

    "/api/users/me/profile": {
      get: op({ tag: "Users", summary: "My profile", auth: true, errs: [401, 404] }),
      patch: op({ tag: "Users", summary: "Update profile fields", auth: true, example: { weightKg: 80, limitations: ["Knee"] }, errs: [400, 401] }),
    },
    "/api/users/me/onboarding": {
      post: op({
        tag: "Users",
        summary: "Complete onboarding (+ disclaimer) → auto-generates AI plan",
        auth: true,
        example: {
          name: "Sara", age: 24, gender: "Female", heightCm: 168, weightKg: 62,
          goal: "Muscle Building", experienceLevel: "Beginner", activityLevel: "Moderate",
          daysPerWeek: 4, mealsPerDay: 3, dietaryPreference: "No restriction",
          limitations: ["Knee"], disclaimerAccepted: true,
        },
        responses: created("Onboarding complete; plan returned"),
        errs: [400, 401],
      }),
    },
    "/api/users/me/ai-plan": {
      post: op({ tag: "Users", summary: "Regenerate AI plan (fallback path)", auth: true, responses: created(), errs: [400, 401] }),
    },

    "/api/plans/me": { get: op({ tag: "Plans", summary: "My active plan (AI or coach)", auth: true, errs: [401] }) },
    "/api/plans/coach": {
      post: op({
        tag: "Plans",
        summary: "Coach assigns/replaces a subscriber's plan",
        auth: true,
        example: {
          userId: "<userId>",
          workout: { weeklySchedule: [{ dayOfWeek: "Mon", focus: "Lower body", rest: false, items: [{ trackedKey: "bodyweight_squat", sets: 4, reps: "8-12", restSeconds: 90, intensity: "RPE 7" }] }], notes: "" },
          nutrition: { dailyCalories: 2400, protein_g: 160, carbs_g: 250, fat_g: 70, mealStructure: [] },
          notes: "",
        },
        responses: created(),
        errs: [400, 401, 403],
      }),
    },
    "/api/plans/{id}": {
      patch: op({ tag: "Plans", summary: "Coach updates a plan they authored", auth: true, params: [p("id", "Plan id")], example: { notes: "Increased squat volume" }, errs: [400, 401, 403, 404] }),
    },

    "/api/exercises": {
      get: op({ tag: "Exercises", summary: "Catalog", params: [q("type", "tracked|guided"), q("category", "e.g. Legs")], errs: [] }),
      post: op({ tag: "Exercises", summary: "Create (admin)", auth: true, example: { name: "Goblet Squat", type: "tracked", instructions: "...", trackedKey: "goblet_squat", supportedMistakes: ["knee_valgus"] }, responses: created(), errs: [400, 401, 403] }),
    },
    "/api/exercises/cv-config": {
      get: op({ tag: "Exercises", summary: "On-device CV thresholds keyed by trackedKey", errs: [] }),
    },
    "/api/exercises/{id}": {
      get: op({ tag: "Exercises", summary: "Get one", params: [p("id", "Exercise id")], errs: [404] }),
      patch: op({ tag: "Exercises", summary: "Update (admin)", auth: true, params: [p("id", "Exercise id")], example: { isActive: false }, errs: [400, 401, 403, 404] }),
    },

    "/api/workouts/sessions": {
      post: op({
        tag: "Workouts",
        summary: "Submit a completed session (raw events only)",
        auth: true,
        example: {
          source: "device_cv", dayFocus: "Lower body",
          startedAt: "2026-06-20T17:00:00Z", endedAt: "2026-06-20T17:30:00Z",
          efforts: [{ trackedKey: "bodyweight_squat", setsCompleted: 3, totalReps: 20, correctReps: 15, wrongReps: 5, mistakes: [{ categoryKey: "knee_valgus", count: 3 }] }],
        },
        responses: created("Session saved; summary + optional riskAlert returned"),
        errs: [400, 401, 404],
      }),
      get: op({ tag: "Workouts", summary: "Session history", auth: true, params: [q("page", "", { type: "integer" }), q("limit", "", { type: "integer" }), q("from", "ISO date"), q("to", "ISO date")], errs: [401] }),
    },
    "/api/workouts/sessions/{id}": {
      get: op({ tag: "Workouts", summary: "Get one session", auth: true, params: [p("id", "Session id")], errs: [401, 403, 404] }),
    },

    "/api/progress/summary": { get: op({ tag: "Progress", summary: "Overall stats across all sessions", auth: true, params: [q("from", "ISO"), q("to", "ISO")], errs: [401] }) },
    "/api/progress/risk": { get: op({ tag: "Progress", summary: "Injury-risk profile (or insufficient_data)", auth: true, errs: [401] }) },
    "/api/progress/trends": { get: op({ tag: "Progress", summary: "Risk/accuracy time series", auth: true, params: [q("metric", "risk|accuracy"), q("days", "default 45", { type: "integer" })], errs: [401] }) },

    "/api/coaches": { get: op({ tag: "Coaches", summary: "Public directory", params: [q("specialty", ""), q("page", "", { type: "integer" })], errs: [] }) },
    "/api/coaches/applications": {
      post: op({ tag: "Coaches", summary: "Apply to become a coach", auth: true, example: { bio: "...", specialties: ["Strength"], yearsExperience: 5, governmentIdMediaId: "<mediaId>", certificationMediaIds: ["<mediaId>"] }, responses: created(), errs: [400, 401, 409] }),
    },
    "/api/coaches/me/profile": {
      get: op({ tag: "Coaches", summary: "My coach profile", auth: true, errs: [401, 404] }),
      patch: op({ tag: "Coaches", summary: "Update my coach profile", auth: true, example: { bio: "...", specialties: ["Rehab"], areasOfExpertise: ["Knee rehab"] }, errs: [400, 401, 404] }),
    },
    "/api/coaches/me/subscribers": { get: op({ tag: "Coaches", summary: "My active subscribers", auth: true, errs: [401] }) },
    "/api/coaches/me/subscribers/{userId}/progress": { get: op({ tag: "Coaches", summary: "A subscriber's progress + risk (read-only)", auth: true, params: [p("userId", "Subscriber id")], errs: [401, 403] }) },
    "/api/coaches/me/transformations": { post: op({ tag: "Coaches", summary: "Add a transformation showcase", auth: true, example: { title: "12-week cut", description: "...", beforeMediaId: "<id>", afterMediaId: "<id>", durationWeeks: 12 }, responses: created(), errs: [400, 401] }) },
    "/api/coaches/{id}": { get: op({ tag: "Coaches", summary: "Public coach profile", params: [p("id", "Coach id")], errs: [404] }) },
    "/api/coaches/{id}/reviews": {
      get: op({ tag: "Coaches", summary: "Coach reviews", params: [p("id", "Coach id")], errs: [] }),
      post: op({ tag: "Coaches", summary: "Review a coach (subscription derived by backend)", auth: true, params: [p("id", "Coach id")], example: { rating: 5, comment: "Great coach" }, responses: created(), errs: [400, 401, 403, 409] }),
    },
    "/api/coaches/{id}/transformations": { get: op({ tag: "Coaches", summary: "Coach transformations", params: [p("id", "Coach id")], errs: [] }) },

    "/api/subscriptions/me": {
      get: op({ tag: "Subscriptions", summary: "My active subscription", auth: true, errs: [401] }),
      delete: op({ tag: "Subscriptions", summary: "Cancel (stays active until period end)", auth: true, errs: [401, 404] }),
    },
    "/api/subscriptions": {
      post: op({ tag: "Subscriptions", summary: "Subscribe to a coach (creates mock Payment)", auth: true, example: { coachId: "<coachId>" }, responses: created(), errs: [400, 401, 404, 409] }),
    },

    "/api/notifications": { get: op({ tag: "Notifications", summary: "My notifications", auth: true, params: [q("unread", "true|false"), q("page", "", { type: "integer" })], errs: [401] }) },
    "/api/notifications/read-all": { patch: op({ tag: "Notifications", summary: "Mark all read", auth: true, errs: [401] }) },
    "/api/notifications/{id}/read": { patch: op({ tag: "Notifications", summary: "Mark one read", auth: true, params: [p("id", "Notification id")], errs: [401, 404] }) },

    "/api/media": {
      post: {
        tags: ["Media"],
        summary: "Upload media (multipart: file + kind)",
        security: bearer,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                  kind: { type: "string", enum: ["profile_image", "coach_id_doc", "certification", "transformation_before", "transformation_after", "exercise_demo"] },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Returns mediaId + url" }, 400: errors[400], 401: errors[401] },
      },
    },
    "/api/media/{id}": {
      get: op({ tag: "Media", summary: "Fetch media (private kinds require owner/admin)", params: [p("id", "Media id")], errs: [401, 403, 404] }),
    },

    "/api/admin/dashboard": { get: op({ tag: "Admin", summary: "Platform metrics", auth: true, errs: [401, 403] }) },
    "/api/admin/users": { get: op({ tag: "Admin", summary: "List users", auth: true, params: [q("role", "user|coach|admin"), q("search", ""), q("page", "", { type: "integer" })], errs: [401, 403] }) },
    "/api/admin/users/{id}": { get: op({ tag: "Admin", summary: "Get user", auth: true, params: [p("id", "User id")], errs: [401, 403, 404] }) },
    "/api/admin/users/{id}/role": { patch: op({ tag: "Admin", summary: "Change a user's role", auth: true, params: [p("id", "User id")], example: { role: "coach" }, errs: [400, 401, 403, 404] }) },
    "/api/admin/coach-applications": { get: op({ tag: "Admin", summary: "Review queue", auth: true, params: [q("status", "pending|approved|rejected")], errs: [401, 403] }) },
    "/api/admin/coach-applications/{id}": { patch: op({ tag: "Admin", summary: "Approve/reject (creates CoachProfile on approve)", auth: true, params: [p("id", "Application id")], example: { decision: "approved", note: "" }, errs: [400, 401, 403, 404] }) },
    "/api/admin/mistake-categories": {
      get: op({ tag: "Admin", summary: "List mistake taxonomy", auth: true, errs: [401, 403] }),
      post: op({ tag: "Admin", summary: "Upsert a mistake category", auth: true, example: { key: "knee_valgus", label: "Knees collapsing inward", appliesTo: ["bodyweight_squat"], bodyRegion: "Knee", severityWeight: 4, correctiveCue: "Push your knees out" }, errs: [400, 401, 403] }),
    },
  },
};
