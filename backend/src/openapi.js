/**
 * OpenAPI 3.0 spec — edit here as you add routes.
 * UI: GET /api-docs   |   Raw JSON: GET /openapi.json
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "FitGuard API",
    version: "0.4.0",
    description: "Production-style backend contract for FitGuard. Base path: `/api`.",
  },
  servers: [{ url: "/", description: "This server" }],
  tags: [
    { name: "Health", description: "Liveness" },
    { name: "Auth", description: "Registration and JWT" },
    { name: "Users", description: "Profile and AI free-tier plan" },
    { name: "Coaches", description: "Coach applications and listing" },
    { name: "Subscriptions", description: "Monthly coach subscriptions" },
    { name: "Exercises", description: "Tracked and guided exercise catalog" },
    { name: "Workouts", description: "Assigned workout and nutrition plans" },
    { name: "Progress", description: "Workout sessions and CV stats" },
    { name: "Admin", description: "Application control and user management" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
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
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["user", "coach", "admin"] },
          profile: { $ref: "#/components/schemas/UserProfile" },
          emailVerified: { type: "boolean" },
          emailVerifiedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      UserProfile: {
        type: "object",
        required: [
          "age",
          "heightCm",
          "weightKg",
          "mealsPerDay",
          "gender",
          "goal",
          "activityLevel",
          "dietaryPreference",
        ],
        properties: {
          name: { type: "string", nullable: true },
          age: { type: "integer", minimum: 8, maximum: 110, example: 24 },
          heightCm: { type: "number", minimum: 80, maximum: 260, example: 175 },
          weightKg: { type: "number", minimum: 20, maximum: 350, example: 72 },
          mealsPerDay: { type: "integer", minimum: 1, maximum: 12, example: 4 },
          gender: { type: "string", enum: ["Male", "Female"] },
          goal: { type: "string", enum: ["Muscle Building", "Weight Loss", "Maintain"] },
          activityLevel: {
            type: "string",
            enum: ["Sedentary", "Light", "Moderate", "Active", "Very Active"],
          },
          dietaryPreference: {
            type: "string",
            enum: ["No restriction", "Vegetarian", "Vegan", "Pescatarian", "Low-carb"],
          },
          foodDislikes: { type: "string", example: "liver, okra..." },
          healthConditions: {
            type: "string",
            example: "diabetes, high blood pressure...",
          },
          allergies: { type: "string", example: "nuts, lactose, gluten..." },
        },
      },
      RegisterBody: {
        type: "object",
        required: ["email", "password", "profile"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password", minLength: 8 },
          role: {
            type: "string",
            enum: ["user"],
            default: "user",
            description: "Always resolves to user. Cannot self-register as trainer or admin.",
          },
          profile: { $ref: "#/components/schemas/UserProfile" },
        },
      },
      LoginBody: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
        },
      },
      Exercise: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          type: { type: "string", enum: ["tracked", "guided"] },
          instructions: { type: "string" },
          isActive: { type: "boolean" },
        },
      },
      PlanAssignment: {
        type: "object",
        properties: {
          _id: { type: "string" },
          userId: { type: "string" },
          assignedBy: { type: "string" },
          source: { type: "string", enum: ["ai", "coach"] },
          workoutPlan: { type: "array", items: { type: "string" } },
          nutritionPlan: { type: "array", items: { type: "string" } },
          notes: { type: "string" },
          active: { type: "boolean" },
        },
      },
      Subscription: {
        type: "object",
        properties: {
          _id: { type: "string" },
          userId: { type: "string" },
          coachId: { type: "string" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["active", "cancelled", "expired"] },
        },
      },
      WorkoutSession: {
        type: "object",
        properties: {
          _id: { type: "string" },
          userId: { type: "string" },
          exerciseId: { type: "string" },
          tracked: { type: "boolean" },
          totalReps: { type: "number" },
          correctReps: { type: "number" },
          wrongReps: { type: "number" },
          mistakes: {
            type: "array",
            items: {
              type: "object",
              properties: { type: { type: "string" }, count: { type: "number" } },
            },
          },
          sessionAt: { type: "string", format: "date-time" },
        },
      },
      AdminUserRoleUpdateBody: {
        type: "object",
        required: ["role"],
        properties: {
          role: { type: "string", enum: ["user", "coach", "admin"] },
        },
      },
      CoachProfile: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          name: { type: "string", nullable: true },
          bio: { type: "string", nullable: true, maxLength: 500 },
          specialties: { type: "array", items: { type: "string" } },
          memberSince: { type: "string", format: "date-time" },
        },
      },
      WorkoutSessionDetail: {
        type: "object",
        properties: {
          _id: { type: "string" },
          userId: { type: "string" },
          exerciseId: {
            type: "object",
            properties: {
              _id: { type: "string" },
              name: { type: "string" },
              type: { type: "string", enum: ["tracked", "guided"] },
              instructions: { type: "string" },
            },
          },
          tracked: { type: "boolean" },
          totalReps: { type: "integer" },
          correctReps: { type: "integer" },
          wrongReps: { type: "integer" },
          mistakes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string" },
                count: { type: "integer", minimum: 1 },
              },
            },
          },
          sessionAt: { type: "string", format: "date-time" },
        },
      },
      AssignPlanBody: {
        type: "object",
        required: ["userId", "workoutPlan"],
        properties: {
          userId: {
            type: "string",
            description: "ObjectId of the subscribed user to assign the plan to",
          },
          workoutPlan: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            example: ["3x10 squats", "3x12 push-ups", "30 min cardio"],
          },
          nutritionPlan: {
            type: "array",
            items: { type: "string" },
            example: ["2500 kcal/day", "150g protein", "Avoid processed sugar"],
          },
          notes: { type: "string", example: "Focus on form over weight this week." },
        },
      },
      ForgotPasswordBody: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } },
      },
      ResetPasswordBody: {
        type: "object",
        required: ["token", "newPassword"],
        properties: {
          token: {
            type: "string",
            description: "Token received from forgot-password response (dev) or email link (prod)",
          },
          newPassword: { type: "string", minLength: 8, format: "password" },
        },
      },
    },
  },
  paths: {
    "/api/health": {
      get: { tags: ["Health"], summary: "Health check", responses: { 200: { description: "OK" } } },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register with complete fitness profile",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterBody" } } },
        },
        responses: {
          201: { description: "Created" },
          400: {
            description: "Validation",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          409: { description: "Email taken" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginBody" } } } },
        responses: {
          200: { description: "JWT + user" },
          401: { description: "Invalid credentials" },
          403: { description: "Email verification required" },
        },
      },
    },
    "/api/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request password reset token",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ForgotPasswordBody" } },
          },
        },
        responses: {
          200: { description: "Reset link sent (or silently ignored if email not found)" },
        },
      },
    },
    "/api/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password using token",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ResetPasswordBody" } },
          },
        },
        responses: {
          200: { description: "Password reset successful" },
          400: { description: "Invalid or expired token" },
        },
      },
    },
    "/api/auth/verify-email": {
      get: {
        tags: ["Auth"],
        summary: "Verify email address",
        parameters: [{ in: "query", name: "token", required: true, schema: { type: "string" } }],
        responses: {
          200: { description: "Email verified" },
          400: { description: "Invalid token" },
        },
      },
    },
    "/api/users/me/profile": {
      get: { tags: ["Users"], summary: "Get current user profile", security: [{ bearerAuth: [] }], responses: { 200: { description: "Profile" } } },
      patch: {
        tags: ["Users"],
        summary: "Update current user profile",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/UserProfile" } } } },
        responses: { 200: { description: "Profile updated" } },
      },
    },
    "/api/users/me/ai-plan": {
      post: {
        tags: ["Users"],
        summary: "Generate free-tier AI plan (stub)",
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: "Plan generated" } },
      },
    },
    "/api/coaches/public": {
      get: {
        tags: ["Coaches"],
        summary: "List approved coaches",
        responses: {
          200: {
            description: "Coach list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    coaches: {
                      type: "array",
                      items: { $ref: "#/components/schemas/CoachProfile" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/coaches/applications": {
      post: {
        tags: ["Coaches"],
        summary: "Apply to become coach (user role)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  bio: {
                    type: "string",
                    maxLength: 500,
                    example: "Certified personal trainer with 5 years experience.",
                  },
                  specialties: {
                    type: "array",
                    items: { type: "string" },
                    example: ["Weight Loss", "HIIT", "Nutrition"],
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Application submitted" } },
      },
      get: { tags: ["Coaches"], summary: "List pending coach applications (admin)", security: [{ bearerAuth: [] }], responses: { 200: { description: "Pending applications" } } },
    },
    "/api/coaches/applications/{id}/decision": {
      patch: {
        tags: ["Coaches"],
        summary: "Approve/reject coach application (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Decision recorded" } },
      },
    },
    "/api/coaches/me/profile": {
      patch: {
        tags: ["Coaches"],
        summary: "Update coach bio and specialties (trainer role)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  bio: { type: "string", maxLength: 500 },
                  specialties: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Profile updated" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden - trainer role required" },
          404: { description: "No approved coach profile found" },
        },
      },
    },
    "/api/coaches/me/subscribers": {
      get: {
        tags: ["Coaches"],
        summary: "List active subscribers for the authenticated coach (trainer role)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Subscriber list" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
        },
      },
    },
    "/api/coaches/{id}": {
      get: {
        tags: ["Coaches"],
        summary: "Get public coach profile by ID",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Coach profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { coach: { $ref: "#/components/schemas/CoachProfile" } },
                },
              },
            },
          },
          404: { description: "Coach not found" },
        },
      },
    },
    "/api/subscriptions/me": {
      get: { tags: ["Subscriptions"], summary: "Get my active subscription", security: [{ bearerAuth: [] }], responses: { 200: { description: "Subscription or null" } } },
      delete: { tags: ["Subscriptions"], summary: "Cancel my active subscription", security: [{ bearerAuth: [] }], responses: { 200: { description: "Cancelled" } } },
    },
    "/api/subscriptions": {
      post: {
        tags: ["Subscriptions"],
        summary: "Subscribe to one coach for one month",
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["coachId"], properties: { coachId: { type: "string" } } } } } },
        responses: { 201: { description: "Subscribed" }, 409: { description: "Already subscribed" } },
      },
    },
    "/api/exercises": {
      get: { tags: ["Exercises"], summary: "List active exercises", parameters: [{ in: "query", name: "type", schema: { type: "string", enum: ["tracked", "guided"] } }], responses: { 200: { description: "Exercise list" } } },
      post: { tags: ["Exercises"], summary: "Create exercise (admin)", security: [{ bearerAuth: [] }], responses: { 201: { description: "Exercise created" } } },
    },
    "/api/exercises/{id}": {
      get: {
        tags: ["Exercises"],
        summary: "Get exercise by ID",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Exercise" }, 404: { description: "Not found" } },
      },
      patch: {
        tags: ["Exercises"],
        summary: "Update exercise (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string", enum: ["tracked", "guided"] },
                  instructions: { type: "string" },
                  isActive: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden" },
          404: { description: "Not found" },
        },
      },
    },
    "/api/workouts/me/plan": { get: { tags: ["Workouts"], summary: "Get my current active plan", security: [{ bearerAuth: [] }], responses: { 200: { description: "Plan or null" } } } },
    "/api/workouts/coach/assignments": {
      post: {
        tags: ["Workouts"],
        summary: "Coach assigns plan to subscribed user",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AssignPlanBody" } } },
        },
        responses: { 201: { description: "Plan assigned" } },
      },
    },
    "/api/progress/sessions": { post: { tags: ["Progress"], summary: "Log workout session with tracked stats", security: [{ bearerAuth: [] }], responses: { 201: { description: "Session logged" } } } },
    "/api/progress/sessions/{id}": {
      get: {
        tags: ["Progress"],
        summary: "Get a single workout session by ID",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Session detail",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { session: { $ref: "#/components/schemas/WorkoutSessionDetail" } },
                },
              },
            },
          },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden - not your session" },
          404: { description: "Session not found" },
        },
      },
    },
    "/api/progress/me": {
      get: {
        tags: ["Progress"],
        summary: "Get progress summary and recent sessions",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "query", name: "page", schema: { type: "integer", default: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", default: 20 } },
          {
            in: "query",
            name: "from",
            schema: { type: "string", format: "date" },
            description: "ISO date string, e.g. 2025-01-01",
          },
          {
            in: "query",
            name: "to",
            schema: { type: "string", format: "date" },
            description: "ISO date string, e.g. 2025-12-31",
          },
        ],
        responses: { 200: { description: "Progress data" } },
      },
    },
    "/api/admin/dashboard": {
      get: {
        tags: ["Admin"],
        summary: "Admin metrics overview",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Metrics" }, 403: { description: "Forbidden" } },
      },
    },
    "/api/admin/users": {
      get: {
        tags: ["Admin"],
        summary: "Get all users (paginated)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: "query", name: "page", schema: { type: "integer", minimum: 1, default: 1 } },
          { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { in: "query", name: "role", schema: { type: "string", enum: ["user", "coach", "admin"] } },
          { in: "query", name: "search", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Users list" }, 403: { description: "Forbidden" } },
      },
    },
    "/api/admin/users/{id}": {
      get: {
        tags: ["Admin"],
        summary: "Get user by id",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "User" }, 404: { description: "Not found" } },
      },
    },
    "/api/admin/users/{id}/role": {
      patch: {
        tags: ["Admin"],
        summary: "Change user role",
        security: [{ bearerAuth: [] }],
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/AdminUserRoleUpdateBody" } },
          },
        },
        responses: { 200: { description: "Updated" }, 404: { description: "Not found" } },
      },
    },
  },
};
