import { and, eq, inArray, lt, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  comments,
  projectMembers,
  projects,
  tasks,
  users,
} from "../drizzle/schema";
import { DEMO_LOGIN_METHOD, DEMO_SESSION_MAX_AGE_MS } from "../shared/const";
import { DAY_MS } from "../shared/dates";
import { getDb } from "./db";
import { purgeStaleRateLimits } from "./rateLimit";

/**
 * Demo mode: every visitor gets an isolated, throwaway workspace with
 * realistic data. Demo users are marked with loginMethod = "demo", have no
 * password and are deleted after DEMO_SESSION_MAX_AGE_MS.
 */

export type DemoLocale = "en" | "pt-BR";

type Text = { pt: string; en: string };
type Person = 0 | 1 | 2 | 3; // 0 = the visitor, 1-3 = fictional teammates
type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";

type SeedTask = {
  title: Text;
  description?: Text;
  status: Status;
  priority: Priority;
  dueInDays: number | null;
  assignee: Person | null;
  comments?: { author: Person; text: Text; hoursAgo: number }[];
};

type SeedProject = {
  name: Text;
  description: Text;
  color: string;
  tasks: SeedTask[];
};

const PEOPLE: Record<"pt" | "en", [string, string, string, string]> = {
  pt: ["Visitante", "Ana Souza", "Bruno Lima", "Carla Mendes"],
  en: ["Guest", "Alex Morgan", "Sam Rivera", "Jordan Lee"],
};

const DEMO_PROJECTS: SeedProject[] = [
  {
    name: { pt: "Lançamento do App Mobile", en: "Mobile App Launch" },
    description: {
      pt: "Versão 1.0 do app iOS e Android, com login social e notificações push.",
      en: "Version 1.0 of the iOS and Android app, with social login and push notifications.",
    },
    color: "#6366f1",
    tasks: [
      {
        title: {
          pt: "Corrigir crash ao abrir a câmera no Android 14",
          en: "Fix camera crash on Android 14",
        },
        description: {
          pt: "Acontece ao anexar foto no perfil. Afeta cerca de 8% das sessões no beta.",
          en: "Happens when attaching a profile photo. Affects about 8% of beta sessions.",
        },
        status: "in_progress",
        priority: "high",
        dueInDays: -1,
        assignee: 2,
        comments: [
          {
            author: 2,
            text: {
              pt: "Reproduzi no Pixel 8. É a nova permissão de mídia do Android 14.",
              en: "Reproduced on a Pixel 8. It's the new Android 14 media permission.",
            },
            hoursAgo: 20,
          },
          {
            author: 1,
            text: {
              pt: "Boa! Consegue subir o fix antes da build de sexta?",
              en: "Nice! Can you ship the fix before Friday's build?",
            },
            hoursAgo: 18,
          },
        ],
      },
      {
        title: {
          pt: "Login com Google e Apple",
          en: "Sign in with Google and Apple",
        },
        description: {
          pt: "OAuth nativo em cada plataforma e validação do token no backend.",
          en: "Native OAuth on each platform and token validation on the backend.",
        },
        status: "in_progress",
        priority: "high",
        dueInDays: 2,
        assignee: 0,
        comments: [
          {
            author: 1,
            text: {
              pt: "A Apple exige o botão próprio quando há outro login social. Já está no layout.",
              en: "Apple requires its own button when another social login exists. It's in the layout.",
            },
            hoursAgo: 6,
          },
        ],
      },
      {
        title: {
          pt: "Notificações push de lembrete",
          en: "Reminder push notifications",
        },
        status: "todo",
        priority: "medium",
        dueInDays: 5,
        assignee: 3,
      },
      {
        title: {
          pt: "Textos e screenshots da App Store",
          en: "App Store copy and screenshots",
        },
        status: "todo",
        priority: "low",
        dueInDays: 9,
        assignee: 1,
      },
      {
        title: {
          pt: "Teste de usabilidade com 5 usuários",
          en: "Usability test with 5 users",
        },
        status: "todo",
        priority: "medium",
        dueInDays: null,
        assignee: 0,
      },
      {
        title: {
          pt: "Pipeline de CI/CD com deploy na loja",
          en: "CI/CD pipeline with store deploys",
        },
        status: "done",
        priority: "high",
        dueInDays: -6,
        assignee: 2,
      },
      {
        title: {
          pt: "Ícone e splash screen",
          en: "App icon and splash screen",
        },
        status: "done",
        priority: "medium",
        dueInDays: -10,
        assignee: 1,
      },
    ],
  },
  {
    name: { pt: "Redesign do Site", en: "Website Redesign" },
    description: {
      pt: "Novo site institucional focado em conversão e performance.",
      en: "New marketing site focused on conversion and performance.",
    },
    color: "#ec4899",
    tasks: [
      {
        title: {
          pt: "Revisar SEO das páginas principais",
          en: "SEO review of key pages",
        },
        description: {
          pt: "Títulos, meta descriptions e dados estruturados.",
          en: "Titles, meta descriptions and structured data.",
        },
        status: "todo",
        priority: "medium",
        dueInDays: -2,
        assignee: 0,
      },
      {
        title: { pt: "Página de preços", en: "Pricing page" },
        status: "in_progress",
        priority: "high",
        dueInDays: 1,
        assignee: 0,
        comments: [
          {
            author: 3,
            text: {
              pt: "Podemos destacar o plano anual com 2 meses grátis?",
              en: "Can we highlight the yearly plan with 2 months free?",
            },
            hoursAgo: 3,
          },
        ],
      },
      {
        title: {
          pt: "Otimizar imagens e Core Web Vitals",
          en: "Optimize images and Core Web Vitals",
        },
        status: "todo",
        priority: "medium",
        dueInDays: 6,
        assignee: 2,
      },
      {
        title: {
          pt: "Migrar o blog para o novo layout",
          en: "Move the blog to the new layout",
        },
        status: "todo",
        priority: "low",
        dueInDays: 14,
        assignee: 3,
      },
      {
        title: {
          pt: "Design system: cores, tipografia e componentes",
          en: "Design system: colors, type and components",
        },
        status: "done",
        priority: "high",
        dueInDays: -4,
        assignee: 1,
      },
      {
        title: { pt: "Wireframes da nova home", en: "New homepage wireframes" },
        status: "done",
        priority: "medium",
        dueInDays: -8,
        assignee: 1,
      },
    ],
  },
  {
    name: { pt: "Onboarding de Clientes", en: "Customer Onboarding" },
    description: {
      pt: "Fluxo de boas-vindas, tutoriais e base de conhecimento.",
      en: "Welcome flow, tutorials and knowledge base.",
    },
    color: "#22c55e",
    tasks: [
      {
        title: {
          pt: "E-mail de boas-vindas com checklist",
          en: "Welcome email with checklist",
        },
        status: "in_progress",
        priority: "medium",
        dueInDays: 0,
        assignee: 3,
        comments: [
          {
            author: 1,
            text: {
              pt: "Mandei a versão final do texto no Drive, falta só o HTML.",
              en: "Final copy is in the Drive, only the HTML is missing.",
            },
            hoursAgo: 2,
          },
        ],
      },
      {
        title: {
          pt: "Central de ajuda com 10 artigos",
          en: "Help center with 10 articles",
        },
        status: "todo",
        priority: "high",
        dueInDays: 4,
        assignee: 2,
      },
      {
        title: { pt: "Vídeos tutoriais curtos", en: "Short tutorial videos" },
        status: "todo",
        priority: "low",
        dueInDays: 10,
        assignee: 1,
      },
      {
        title: {
          pt: "Pesquisa NPS após 30 dias",
          en: "NPS survey after 30 days",
        },
        status: "todo",
        priority: "low",
        dueInDays: null,
        assignee: null,
      },
      {
        title: {
          pt: "Mapear a jornada do novo cliente",
          en: "Map the new customer journey",
        },
        status: "done",
        priority: "medium",
        dueInDays: -12,
        assignee: 3,
      },
    ],
  },
];

/** Start of "today" in the visitor's timezone, as a UTC timestamp. */
function startOfVisitorDay(now: number, tzOffsetMinutes: number) {
  const offsetMs = tzOffsetMinutes * 60_000;
  return Math.floor((now - offsetMs) / DAY_MS) * DAY_MS + offsetMs;
}

export async function createDemoWorkspace(options: {
  locale: DemoLocale;
  tzOffsetMinutes: number;
}) {
  const lang = options.locale === "pt-BR" ? "pt" : "en";
  const db = getDb();
  const demoId = nanoid(12);
  const now = new Date();
  const today = startOfVisitorDay(now.getTime(), options.tzOffsetMinutes);

  const peopleRows = PEOPLE[lang].map((name, i) => ({
    openId: i === 0 ? `demo:${demoId}` : `demo:${demoId}:${i}`,
    name,
    email:
      i === 0
        ? `demo-${demoId}@demo.taskflow.invalid`
        : `demo-${demoId}-${i}@demo.taskflow.invalid`,
    loginMethod: DEMO_LOGIN_METHOD,
    role: "user" as const,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  }));

  const insertedUsers = await db
    .insert(users)
    .values(peopleRows)
    .returning({ id: users.id, openId: users.openId });
  const userIdByOpenId = new Map(insertedUsers.map(u => [u.openId, u.id]));
  const personIds = peopleRows.map(p => userIdByOpenId.get(p.openId)!);
  const visitorId = personIds[0]!;

  // Newest first in the project list, so the first seed project shows on top.
  const insertedProjects = await db
    .insert(projects)
    .values(
      DEMO_PROJECTS.map((p, i) => ({
        name: p.name[lang],
        description: p.description[lang],
        color: p.color,
        ownerId: visitorId,
        createdAt: new Date(now.getTime() - i * 60_000),
        updatedAt: now,
      }))
    )
    .returning({ id: projects.id, name: projects.name });
  const projectIdByName = new Map(insertedProjects.map(p => [p.name, p.id]));
  const projectIds = DEMO_PROJECTS.map(p => projectIdByName.get(p.name[lang])!);

  await db.insert(projectMembers).values(
    projectIds.flatMap(projectId =>
      personIds.map((userId, i) => ({
        projectId,
        userId,
        role: i === 0 ? ("owner" as const) : ("member" as const),
        joinedAt: now,
      }))
    )
  );

  const taskRows = DEMO_PROJECTS.flatMap((project, projectIndex) => {
    const positions: Record<Status, number> = {
      todo: 0,
      in_progress: 0,
      done: 0,
    };
    return project.tasks.map(task => {
      const dueDate =
        task.dueInDays === null
          ? null
          : new Date(today + task.dueInDays * DAY_MS);
      return {
        title: task.title[lang],
        description: task.description?.[lang] ?? null,
        status: task.status,
        priority: task.priority,
        dueDate,
        completedAt: task.status === "done" ? (dueDate ?? now) : null,
        position: positions[task.status]++,
        projectId: projectIds[projectIndex]!,
        assigneeId: task.assignee === null ? null : personIds[task.assignee]!,
        createdAt: now,
        updatedAt: now,
      };
    });
  });

  const insertedTasks = await db
    .insert(tasks)
    .values(taskRows)
    .returning({ id: tasks.id, title: tasks.title });
  const taskIdByTitle = new Map(insertedTasks.map(t => [t.title, t.id]));

  const commentRows = DEMO_PROJECTS.flatMap(project =>
    project.tasks.flatMap(task =>
      (task.comments ?? []).map(c => {
        const createdAt = new Date(now.getTime() - c.hoursAgo * 60 * 60 * 1000);
        return {
          taskId: taskIdByTitle.get(task.title[lang])!,
          authorId: personIds[c.author]!,
          content: c.text[lang],
          createdAt,
          updatedAt: createdAt,
        };
      })
    )
  );
  if (commentRows.length > 0) {
    await db.insert(comments).values(commentRows);
  }

  return { userId: visitorId, projectId: projectIds[0]! };
}

/**
 * Deletes demo workspaces older than maxAgeMs. Rows are removed explicitly in
 * dependency order instead of relying on ON DELETE CASCADE, because SQLite
 * only enforces foreign keys when PRAGMA foreign_keys is on.
 */
export async function cleanupExpiredDemos(
  maxAgeMs: number = DEMO_SESSION_MAX_AGE_MS
) {
  const db = getDb();
  const cutoff = new Date(Date.now() - maxAgeMs);

  const isExpiredDemoUser = and(
    eq(users.loginMethod, DEMO_LOGIN_METHOD),
    lt(users.createdAt, cutoff)
  );
  const expiredUsers = db
    .select({ id: users.id })
    .from(users)
    .where(isExpiredDemoUser);
  const demoProjects = db
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.ownerId, expiredUsers));
  const demoTasks = db
    .select({ id: tasks.id })
    .from(tasks)
    .where(inArray(tasks.projectId, demoProjects));

  await db.batch([
    db
      .delete(comments)
      .where(
        or(
          inArray(comments.taskId, demoTasks),
          inArray(comments.authorId, expiredUsers)
        )
      ),
    db.delete(tasks).where(inArray(tasks.projectId, demoProjects)),
    db
      .update(tasks)
      .set({ assigneeId: null })
      .where(inArray(tasks.assigneeId, expiredUsers)),
    db
      .delete(projectMembers)
      .where(
        or(
          inArray(projectMembers.projectId, demoProjects),
          inArray(projectMembers.userId, expiredUsers)
        )
      ),
    db.delete(projects).where(inArray(projects.ownerId, expiredUsers)),
    db.delete(users).where(isExpiredDemoUser),
  ]);

  await purgeStaleRateLimits();
}
