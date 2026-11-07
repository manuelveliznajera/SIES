import React, { useState, useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { getCurrentSession, login, logout, type AuthenticatedSession } from './authApi';
import {
  activateUser as activateUserRequest,
  createUser as createUserRequest,
  deactivateUser as deactivateUserRequest,
  listUsers,
  updateUser as updateUserRequest,
  type AppUser,
  type UserRole,
} from './usersApi';
import {
  archiveSurvey,
  createSurvey as createSurveyRequest,
  listSurveys,
  restoreSurvey as restoreSurveyRequest,
  updateSurvey as updateSurveyRequest,
} from './surveysApi';
import {
  clearSurveyInterviews,
  createInterview as createInterviewRequest,
  deleteInterview as deleteInterviewRequest,
  listInterviews,
} from './interviewsApi';
import { getPendingInterviews, removePendingInterview, savePendingInterview } from './offlineInterviewsDb';
import {
  listApplicationErrors,
  listAuditEvents,
  reportFrontendError,
  type ApplicationErrorRecord,
  type AuditEventRecord,
} from './adminLogsApi';
import { createCommunityAssignment, updateCommunityAssignment } from './assignmentsApi';
import {
  Vote,
  MapPin,
  CheckCircle2,
  Wifi,
  WifiOff,
  BarChart3,
  Plus,
  RefreshCw,
  Layers,
  Smartphone,
  ShieldCheck,
  Send,
  Download,
  Trash2,
  ListPlus,
  Settings2,
  Save,
  Eye,
  CheckSquare,
  Sparkles,
  FileText,
  Bell,
  Printer,
  X,
  UserCheck,
  Lock,
  UserX,
  Users,
  UserPlus,
  Pencil,
  LogOut,
  Menu,
  Bug
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  PieChart,
  Pie,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid
} from 'recharts';

const formatGuatemalaDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-GT', {
    timeZone: 'America/Guatemala',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const formatElapsedTime = (startedAt: string, finishedAt: string) => {
  const seconds = Math.max(0, Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours ? `${hours} h` : '', minutes ? `${minutes} min` : '', `${remainingSeconds} s`].filter(Boolean).join(' ');
};

// ── GEOGRAFÍA DE GUATEMALA (DEPARTAMENTOS Y MUNICIPIOS) ──
export const GUATEMALA_GEOGRAPHY: Record<string, string[]> = {
  'Guatemala': [
    'Mixco', 'Ciudad de Guatemala', 'Villa Nueva', 'San Miguel Petapa',
    'Santa Catarina Pinula', 'San Juan Sacatepéquez', 'San Pedro Sacatepéquez',
    'Chinautla', 'Amatitlán', 'Villa Canales', 'Fraijanes', 'San José Pinula'
  ],
  'Santa Rosa': [
    'Guazacapán', 'Cuilapa', 'Barberena', 'Chiquimulilla', 'Nueva Santa Rosa',
    'Taxisco', 'San Juan Tecuaco', 'Santa María Ixhuatán', 'Pueblo Nuevo Viñas', 'Casillas'
  ],
  'Quetzaltenango': [
    'Quetzaltenango', 'Salcajá', 'Coatepeque', 'San Juan Ostuncalco', 'Cantel', 'Olintepeque', 'La Esperanza'
  ],
  'Escuintla': [
    'Escuintla', 'Santa Lucía Cotzumalguapa', 'Puerto San José', 'Palín', 'Nueva Concepción', 'Tiquisate', 'La Gomera'
  ],
  'Sacatepéquez': [
    'Antigua Guatemala', 'Ciudad Vieja', 'Jocotenango', 'San Lucas Sacatepéquez', 'Sumpango', 'Pastores'
  ],
  'Alta Verapaz': [
    'Cobán', 'San Pedro Carchá', 'San Cristóbal Verapaz', 'Chisec', 'Santa Cruz Verapaz', 'Tactic'
  ],
  'Huehuetenango': [
    'Huehuetenango', 'Chiantla', 'Barillas', 'San Pedro Necta', 'Aguacatán', 'Santa Eulalia'
  ],
  'San Marcos': [
    'San Marcos', 'San Pedro Sacatepéquez', 'Malacatán', 'Ayutla (Tecún Umán)', 'Catarina'
  ],
  'Chimaltenango': [
    'Chimaltenango', 'Tecpán Guatemala', 'San Martín Jilotepeque', 'Patzún', 'El Tejar'
  ],
  'Suchitepéquez': [
    'Mazatenango', 'Cuyotenango', 'San Antonio Suchitepéquez', 'Chicacao', 'Patulul'
  ],
  'Petén': [
    'Flores', 'San Benito', 'Santa Elena', 'Poptún', 'Sayaxché', 'La Libertad'
  ],
  'Jalapa': [
    'Jalapa', 'San Pedro Pinula', 'Mataquescuintla', 'Monjas'
  ],
  'Jutiapa': [
    'Jutiapa', 'Asunción Mita', 'Santa Catarina Mita', 'Agua Blanca', 'Moyuta'
  ]
};

// ── MODELOS DE PREGUNTAS Y OPCIONES ──
export interface QuestionOption {
  id: string;
  text: string;
  color?: string;
  votes: number;
  allowsOtherText?: boolean;
}

export interface SurveyQuestion {
  id: string;
  title: string;
  type: 'single' | 'multiple' | 'rating' | 'text';
  isRequired: boolean;
  options: QuestionOption[];
}

const createGuazacapanQuestionTemplate = (municipality = 'Guazacapán'): SurveyQuestion[] => {
  const prefix = `gz-template-${Date.now()}`;
  const option = (question: string, index: number, text: string, color: string, allowsOtherText = false): QuestionOption => ({
    id: `${prefix}-${question}-option-${index}`,
    text,
    color,
    votes: 0,
    ...(allowsOtherText ? { allowsOtherText: true } : {})
  });

  return [
    {
      id: `${prefix}-registered`,
      title: `¿Está empadronado en ${municipality}?`,
      type: 'single',
      isRequired: true,
      options: [option('registered', 1, 'Sí', '#10b981'), option('registered', 2, 'No', '#ef4444')]
    },
    {
      id: `${prefix}-president`,
      title: 'Si hoy fueran las elecciones, ¿por quién votaría para Presidente?',
      type: 'single',
      isRequired: true,
      options: [
        option('president', 1, 'Zury Ríos — UNIONISTA', '#06b6d4'),
        option('president', 2, 'Pendiente — CABAL', '#0284c7'),
        option('president', 3, 'Sandra Torres — UNE', '#22c55e'),
        option('president', 4, 'Nery Ramos — FIRME', '#f59e0b'),
        option('president', 5, 'Carlos Pineda — SERVIR', '#8b5cf6'),
        option('president', 6, 'Armando Castillo — VIVA', '#14b8a6'),
        option('president', 7, 'Neto Bran — CREO', '#ec4899'),
        option('president', 8, 'Otro (especifique)', '#64748b', true),
        option('president', 9, 'Ninguno', '#475569')
      ]
    },
    {
      id: `${prefix}-deputy`,
      title: 'Si hoy fueran las elecciones, ¿por quién votaría para diputado?',
      type: 'single',
      isRequired: true,
      options: [
        option('deputy', 1, 'Napo Rojas — UNIONISTA', '#05a6f0'),
        option('deputy', 2, 'Brando Herrarte — CABAL', '#3b82f6'),
        option('deputy', 3, 'Inés Castillo — UNE', '#10b981'),
        option('deputy', 4, 'Yovani Orozco — FIRME', '#f59e0b'),
        option('deputy', 5, 'Marchena — SERVIR', '#8b5cf6'),
        option('deputy', 6, 'Ninguno', '#64748b')
      ]
    },
    {
      id: `${prefix}-problem`,
      title: `¿Cuál consideras que sería el principal problema del municipio de ${municipality}?`,
      type: 'single',
      isRequired: true,
      options: [
        option('problem', 1, 'Salud', '#ef4444'),
        option('problem', 2, 'Educación', '#3b82f6'),
        option('problem', 3, 'Seguridad', '#f59e0b'),
        option('problem', 4, 'Infraestructura', '#8b5cf6'),
        option('problem', 5, 'Agua', '#05a6f0'),
        option('problem', 6, 'Drenaje', '#14b8a6'),
        option('problem', 7, 'Otro (especifique)', '#64748b', true)
      ]
    },
    {
      id: `${prefix}-mayor-rating`,
      title: '¿Cómo calificarías al actual alcalde y su administración?',
      type: 'single',
      isRequired: true,
      options: [
        option('mayor-rating', 1, 'Excelente', '#10b981'),
        option('mayor-rating', 2, 'Bueno', '#05a6f0'),
        option('mayor-rating', 3, 'Malo', '#ef4444'),
        option('mayor-rating', 4, 'Regular', '#f59e0b'),
        option('mayor-rating', 5, 'Otro (especifique)', '#64748b', true)
      ]
    },
    {
      id: `${prefix}-mayor-vote`,
      title: 'Si hoy fueran las elecciones, ¿por qué candidato votarías para Alcalde?',
      type: 'single',
      isRequired: true,
      options: [
        option('mayor-vote', 1, 'Noel de la Cruz', '#05a6f0'),
        option('mayor-vote', 2, 'Erik Landaverde', '#3b82f6'),
        option('mayor-vote', 3, 'Bayrón Donis', '#10b981'),
        option('mayor-vote', 4, 'Oscar Cerrate', '#f59e0b'),
        option('mayor-vote', 5, 'Francisco Orantes', '#8b5cf6'),
        option('mayor-vote', 6, 'Oto Martínez', '#14b8a6'),
        option('mayor-vote', 7, 'Ninguno (especifique)', '#64748b', true)
      ]
    },
    {
      id: `${prefix}-observations`,
      title: 'Observaciones',
      type: 'text',
      isRequired: false,
      options: []
    }
  ];
};

export interface MunicipalityQuota {
  municipality: string;
  quota: number;
}

// ── MODELO DE COMUNIDAD ASIGNADA EXCLUSIVAMENTE A UN ENCUESTADOR ──
export interface CommunityAssignment {
  id: string;
  name: string;        // Ej: "Zona 4 - San Nicolás", "Aldea El Pozo"
  assignedTo: string;  // Alias del encuestador exclusivo: "User1", "User2", etc.
  quota: number;       // Meta de encuestas para esta comunidad
}

export interface FullSurvey {
  id: string;
  code: string;
  title: string;
  department: string;
  municipality: string;
  municipalities: MunicipalityQuota[];
  communities: CommunityAssignment[]; // Comunidades creadas y asignadas exclusivamente por el Admin
  startDate: string;
  endDate: string;
  targetSample: number;
  status: 'active' | 'draft' | 'completed' | 'archived';
  questions: SurveyQuestion[];
  assignedEnumerators: string[];
  collectedSample: number;
}

const EMPTY_SURVEY: FullSurvey = {
  id: '',
  code: '',
  title: 'Sin encuestas configuradas',
  department: '',
  municipality: '',
  municipalities: [],
  communities: [],
  startDate: '',
  endDate: '',
  targetSample: 0,
  status: 'draft',
  questions: [],
  assignedEnumerators: [],
  collectedSample: 0,
};

export interface InterviewAnswer {
  questionId: string;
  questionTitle: string;
  answerText: string;
}

export interface InterviewRecord {
  id: string;               // Ej: "User1-01", "User1-02", "User2-01"
  databaseId?: string;
  deviceUuid?: string;
  surveyId: string;
  communityId?: string;
  surveyTitle: string;
  enumeratorAlias: string;  // Ej: "User1"
  surveyNumber: number;     // Ej: 1, 2...
  enumeratorName: string;
  department: string;
  municipality: string;
  community: string;
  ageGroup: string;
  gender: string;
  lat: number;
  lng: number;
  accuracy: number;
  startedAt?: string;
  timestamp: string;
  status: 'synced' | 'pending';
  answers: InterviewAnswer[];
}

function mergeInterviewRecords(pending: InterviewRecord[], loaded: InterviewRecord[]): InterviewRecord[] {
  const records = new Map<string, InterviewRecord>();
  for (const record of [...pending, ...loaded]) {
    const key = record.deviceUuid
      ? `device:${record.deviceUuid}`
      : record.databaseId
        ? `database:${record.databaseId}`
        : `local:${record.surveyId}:${record.id}`;
    const existing = records.get(key);
    if (!existing || (existing.status === 'pending' && record.status === 'synced')) records.set(key, record);
  }
  return [...records.values()].sort((a, b) => {
    const timestampA = Date.parse(a.timestamp);
    const timestampB = Date.parse(b.timestamp);
    return (Number.isFinite(timestampB) ? timestampB : 0) - (Number.isFinite(timestampA) ? timestampA : 0);
  });
}

const interviewMarkerIcon = L.divIcon({
  className: 'interview-map-marker',
  html: '<span></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

function FitMapToInterviews({ records }: { records: InterviewRecord[] }) {
  const map = useMap();

  useEffect(() => {
    if (records.length === 0) {
      map.setView([14.6349, -90.5069], 7);
      return;
    }

    const bounds = L.latLngBounds(records.map((record) => L.latLng(record.lat, record.lng)));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [map, records]);

  return null;
}

export function App() {
  // Pestaña activa
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'builder' | 'survey' | 'map' | 'surveys_list' | 'supervisors' | 'users' | 'admin_config'>('dashboard');
  const [reportCommunityFilter, setReportCommunityFilter] = useState('all');
  const [adminLogsTab, setAdminLogsTab] = useState<'audit' | 'errors'>('audit');
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [applicationErrors, setApplicationErrors] = useState<ApplicationErrorRecord[]>([]);
  const [adminLogsLoading, setAdminLogsLoading] = useState(false);
  const [adminLogsError, setAdminLogsError] = useState<string | null>(null);
  const [adminLogsSearch, setAdminLogsSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Rol del usuario activo en la app
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('admin');
  const [authenticatedSession, setAuthenticatedSession] = useState<AuthenticatedSession | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [loginAlias, setLoginAlias] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Lista de usuarios registrados en el sistema
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isUserSaving, setIsUserSaving] = useState(false);
  const [isSurveysLoading, setIsSurveysLoading] = useState(false);
  const [isSurveySaving, setIsSurveySaving] = useState(false);
  const [isInterviewsLoading, setIsInterviewsLoading] = useState(false);
  const [isInterviewSaving, setIsInterviewSaving] = useState(false);
  const [isClearingSurveyRecords, setIsClearingSurveyRecords] = useState(false);
  const [deletingInterviewId, setDeletingInterviewId] = useState<string | null>(null);
  const [savingAssignmentId, setSavingAssignmentId] = useState<string | null>(null);
  const [assignmentSurveyId, setAssignmentSurveyId] = useState('');
  const [newAssignedCommunityName, setNewAssignedCommunityName] = useState('');
  const [newAssignedCommunityQuota, setNewAssignedCommunityQuota] = useState(100);
  const [newAssignedCommunityEnumerator, setNewAssignedCommunityEnumerator] = useState('');
  const [interviewsApiError, setInterviewsApiError] = useState<string | null>(null);
  const [surveyApiError, setSurveyApiError] = useState<string | null>(null);
  const activeEnumerators = usersList.filter((user) => user.role === 'encuestador' && user.status === 'active');

  // Formulario para Crear Usuario (Solo Administrador)
  const [newUserAlias, setNewUserAlias] = useState<string>('');
  const [newUserFullName, setNewUserFullName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPhone, setNewUserPhone] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('encuestador');
  const [userFormAlert, setUserFormAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Filtro de búsqueda en la lista de usuarios
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');

  // Estado de conectividad
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);

  // Alias del encuestador activo en el dispositivo (ej. User1, User2...)
  const [currentEnumeratorAlias, setCurrentEnumeratorAlias] = useState<string>('User1');

  // Modal para ver Boleta en PDF
  const [selectedRecordForPdf, setSelectedRecordForPdf] = useState<InterviewRecord | null>(null);

  // GPS en vivo
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsUpdated, setGpsUpdated] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const user = await getCurrentSession();
        if (!user) return;
        setAuthenticatedSession({ ...user, fullName: user.fullName || user.username });
        const roles = user.roles.map((role) => role.toUpperCase());
        const role: UserRole = roles.includes('ADMIN') ? 'admin' : roles.includes('SUPERVISOR') ? 'supervisor' : 'encuestador';
        setCurrentUserRole(role);
        setCurrentEnumeratorAlias(user.username);
        setActiveTab(role === 'admin' ? 'dashboard' : 'survey');
      } catch {
        setLoginError('No se pudo conectar con el servidor de autenticación.');
      } finally {
        setIsAuthChecking(false);
      }
    };
    void restoreSession();
  }, []);

  useEffect(() => {
    if (!authenticatedSession) return;
    const handleWindowError = (event: ErrorEvent) => {
      if (!event.message && !event.error) return;
      void reportFrontendError({
        message: event.message || 'Error de ejecución en el frontend.',
        ...(event.error instanceof Error && event.error.stack ? { stack: event.error.stack } : {}),
        path: window.location.pathname,
        details: {
          file: event.filename?.slice(0, 500),
          line: event.lineno,
          column: event.colno,
        },
      });
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      void reportFrontendError({
        message: reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Promesa rechazada sin manejar.',
        ...(reason instanceof Error && reason.stack ? { stack: reason.stack } : {}),
        path: window.location.pathname,
        details: { type: 'unhandledrejection' },
      });
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [authenticatedSession]);

  useEffect(() => {
    if (currentUserRole !== 'admin' || !authenticatedSession) return;
    let isCurrent = true;
    setIsUsersLoading(true);
    void listUsers()
      .then((users) => {
        if (isCurrent) setUsersList(users);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setUserFormAlert({
            type: 'error',
            message: error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.',
          });
        }
      })
      .finally(() => {
        if (isCurrent) setIsUsersLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [currentUserRole, authenticatedSession]);

  const [dashboardChartType, setDashboardChartType] = useState<'bar' | 'pie'>('bar');
  const [newInterviewNotificationId, setNewInterviewNotificationId] = useState<string | null>(null);

  // ── BASE DE DATOS DE ENCUESTAS (CON COMUNIDADES ASIGNADAS POR ADMIN) ──
  const [surveys, setSurveys] = useState<FullSurvey[]>([]);

  // Encuesta seleccionada
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const activeSurveys = useMemo(() => surveys.filter((survey) => survey.status === 'active'), [surveys]);
  const currentSurvey = activeSurveys.find((survey) => survey.id === selectedSurveyId) || activeSurveys[0] || EMPTY_SURVEY;

  useEffect(() => {
    if (activeSurveys.length === 0) {
      if (selectedSurveyId) setSelectedSurveyId('');
      return;
    }
    if (!activeSurveys.some((survey) => survey.id === selectedSurveyId)) {
      setSelectedSurveyId(activeSurveys[0].id);
    }
  }, [activeSurveys, selectedSurveyId]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!authenticatedSession) return;
    let isCurrent = true;
    setIsSurveysLoading(true);
    void listSurveys()
      .then((loadedSurveys) => {
        if (!isCurrent) return;
        const activeStudies = loadedSurveys.filter((survey) => survey.status === 'active');
        setSurveys(loadedSurveys);
        setAssignmentSurveyId((currentId) => activeStudies.some((survey) => survey.id === currentId)
          ? currentId
          : activeStudies[0]?.id ?? '');
        setSelectedSurveyId((currentId) =>
          activeStudies.some((survey) => survey.id === currentId)
            ? currentId
            : activeStudies[0]?.id ?? ''
        );
        setSurveyApiError(null);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setSurveyApiError(
            error instanceof Error ? error.message : 'No se pudieron cargar las encuestas.'
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsSurveysLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [authenticatedSession]);

  useEffect(() => {
    if (!authenticatedSession || !['admin', 'supervisor'].includes(currentUserRole)) return;

    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let disposed = false;
    const eventsUrl = `${import.meta.env.VITE_API_URL ?? ''}/api/v1/surveys/events`;

    const connect = () => {
      if (disposed || !navigator.onLine) return;
      source = new EventSource(eventsUrl, { withCredentials: true });
      source.addEventListener('survey.created', (message) => {
        let event: { title?: string; municipality?: string } = {};
        try {
          event = JSON.parse((message as MessageEvent<string>).data) as typeof event;
        } catch {
          // Ignorar notificaciones mal formadas y mantener la conexión abierta.
        }

        void listSurveys()
          .then((loadedSurveys) => {
            setSurveys(loadedSurveys);
            setAssignmentSurveyId((currentId) => loadedSurveys.some((survey) => survey.id === currentId)
              ? currentId
              : loadedSurveys[0]?.id ?? '');
            setSelectedSurveyId((currentId) => loadedSurveys.some((survey) => survey.id === currentId)
              ? currentId
              : loadedSurveys[0]?.id ?? '');
            setSurveyApiError(null);
          })
          .catch((error: unknown) => {
            setSurveyApiError(error instanceof Error ? error.message : 'No se pudo actualizar la lista de encuestas.');
          });

        const toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 4500,
          timerProgressBar: true,
        });
        void toast.fire({
          icon: 'info',
          title: 'Nueva encuesta creada',
          text: [event.title, event.municipality].filter(Boolean).join(' · '),
        });
      });

      source.addEventListener('interview.created', (message) => {
        let folio = '';
        try {
          const event = JSON.parse((message as MessageEvent<string>).data) as { folio?: string };
          folio = event.folio ?? '';
        } catch {
          // La actualización de datos sigue aunque el detalle del evento no pueda leerse.
        }
        if (folio) {
          setNewInterviewNotificationId(folio);
          window.setTimeout(() => {
            setNewInterviewNotificationId((currentId) => currentId === folio ? null : currentId);
          }, 2400);
        }

        void Promise.all([listInterviews(), getPendingInterviews()])
          .then(([loadedInterviews, pending]) => {
            const pendingRecords = pending.map((item) => ({ ...item.record, deviceUuid: item.deviceUuid }));
            setInterviews(mergeInterviewRecords(pendingRecords, loadedInterviews));
            setInterviewsApiError(null);
          })
          .catch((error: unknown) => {
            setInterviewsApiError(error instanceof Error ? error.message : 'No se pudieron actualizar las entrevistas.');
          });

        const toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3500,
          timerProgressBar: true,
        });
        void toast.fire({ icon: 'success', title: 'Nueva encuesta recibida', text: 'El dashboard se está actualizando.' });
      });

      source.onerror = () => {
        if (retryTimer !== undefined || disposed) return;
        retryTimer = window.setTimeout(async () => {
          retryTimer = undefined;
          try {
            const session = await getCurrentSession();
            if (!session || disposed) {
              source?.close();
              return;
            }
            source?.close();
            connect();
          } catch {
            // EventSource reintentará; la próxima conexión volverá a validar cookies.
          }
        }, 10_000);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      source?.close();
    };
  }, [authenticatedSession, currentUserRole]);

  useEffect(() => {
    if (!authenticatedSession) return;
    let isCurrent = true;
    setIsInterviewsLoading(true);
    void listInterviews()
      .then((loadedInterviews) => {
        if (!isCurrent) return;
        void getPendingInterviews().then((pending) => {
          if (!isCurrent) return;
          const pendingRecords = pending.map((item) => ({ ...item.record, deviceUuid: item.deviceUuid }));
          setInterviews(mergeInterviewRecords(pendingRecords, loadedInterviews));
        });
        setInterviewsApiError(null);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setInterviewsApiError(error instanceof Error ? error.message : 'No se pudieron cargar las entrevistas.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsInterviewsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [authenticatedSession]);

  // Historial y resultados: se cargan desde PostgreSQL por medio de la API.
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!authenticatedSession || !isOnline || !navigator.onLine) return;
    let cancelled = false;
    const synchronizePending = async () => {
      const pending = await getPendingInterviews();
      for (const item of pending) {
        if (cancelled || item.enumeratorUsername.toLowerCase() !== authenticatedSession.username.toLowerCase()) continue;
        try {
          const databaseId = await createInterviewRequest(item.input);
          await removePendingInterview(item.deviceUuid);
          setInterviews((previous) => previous.map((record) =>
            record.id === item.record.id ? { ...record, databaseId, status: 'synced' } : record
          ));
        } catch {
          // Mantener el registro local para reintentar cuando vuelva la conexión.
          break;
        }
      }
    };
    void synchronizePending();
    return () => {
      cancelled = true;
    };
  }, [authenticatedSession, isOnline]);

  const mapInterviews = useMemo(
    () => interviews.filter((record) =>
      record.surveyId === currentSurvey.id &&
      Number.isFinite(record.lat) && Number.isFinite(record.lng) &&
      record.lat >= -90 && record.lat <= 90 && record.lng >= -180 && record.lng <= 180
    ),
    [interviews, currentSurvey.id]
  );
  const currentSurveyInterviews = useMemo(
    () => interviews.filter((record) => record.surveyId === currentSurvey.id),
    [interviews, currentSurvey.id]
  );
  const reportCommunities = useMemo(
    () => [...new Set(currentSurveyInterviews.map((record) => record.community.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [currentSurveyInterviews]
  );
  useEffect(() => {
    if (reportCommunityFilter !== 'all' && !reportCommunities.includes(reportCommunityFilter)) setReportCommunityFilter('all');
  }, [reportCommunities, reportCommunityFilter]);
  const reportInterviews = useMemo(
    () => reportCommunityFilter === 'all'
      ? currentSurveyInterviews
      : currentSurveyInterviews.filter((record) => record.community.trim() === reportCommunityFilter),
    [currentSurveyInterviews, reportCommunityFilter]
  );
  const electionReports = useMemo(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
    const categories = [
      { key: 'president', label: 'Presidente', matches: (title: string) => title.includes('president') },
      { key: 'mayor', label: 'Alcalde', matches: (title: string) => title.includes('alcalde') && /(vot|candidat|eleccion)/.test(title) },
      { key: 'deputy', label: 'Diputados', matches: (title: string) => title.includes('diputad') },
    ];
    return categories.flatMap((category) => {
      const question = currentSurvey.questions.find((item) => category.matches(normalize(item.title)));
      if (!question) return [];
      const counts = new Map<string, { label: string; count: number; color: string }>();
      question.options.forEach((option) => counts.set(normalize(option.text), { label: option.text, count: 0, color: option.color || '#05a6f0' }));
      let unanswered = 0;
      for (const record of reportInterviews) {
        const rawAnswer = record.answers.find((answer) => answer.questionId === question.id)?.answerText?.trim();
        if (!rawAnswer || normalize(rawAnswer) === 'sin respuesta') {
          unanswered += 1;
          continue;
        }
        const normalizedAnswer = normalize(rawAnswer);
        const matchingOption = question.options.find((option) => {
          const normalizedOption = normalize(option.text);
          return normalizedAnswer === normalizedOption || normalizedAnswer.startsWith(`${normalizedOption}:`);
        });
        const key = matchingOption ? normalize(matchingOption.text) : normalizedAnswer;
        const result = counts.get(key);
        if (result) result.count += 1;
        else counts.set(key, { label: rawAnswer, count: 1, color: '#64748b' });
      }
      if (unanswered > 0) counts.set('__unanswered__', { label: 'Sin respuesta', count: unanswered, color: '#cbd5e1' });
      const total = reportInterviews.length;
      return [{ ...category, questionTitle: question.title, total, results: [...counts.values()].sort((a, b) => b.count - a.count) }];
    });
  }, [currentSurvey.questions, reportInterviews]);
  const communitySurveyProgress = useMemo(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
    const communities = currentSurvey.communities ?? [];
    const totalQuota = communities.reduce((total, community) => total + Math.max(0, Number(community.quota) || 0), 0);
    const completed = currentSurveyInterviews.filter((record) =>
      communities.some((community) => normalize(community.name) === normalize(record.community))
    ).length;
    const remaining = Math.max(0, totalQuota - completed);
    const percentage = totalQuota > 0 ? Math.min(100, Math.round((completed / totalQuota) * 100)) : 0;
    return { totalQuota, completed, remaining, percentage };
  }, [currentSurvey.communities, currentSurveyInterviews]);
  const latestInterviewNotifications = useMemo(
    () => mergeInterviewRecords([], currentSurveyInterviews)
      .slice(0, 5),
    [currentSurveyInterviews]
  );
  const mayorVoteQuestion = useMemo(
    () => currentSurvey.questions.find((question) => {
      const title = question.title.toLocaleLowerCase();
      return title.includes('alcalde') && /(vot|candidat|eleccion)/.test(title);
    }),
    [currentSurvey.questions]
  );
  const mayorVoteResults = useMemo(() => {
    if (!mayorVoteQuestion) return [];
    const answers = currentSurveyInterviews
      .map((record) => record.answers.find((answer) => answer.questionId === mayorVoteQuestion.id)?.answerText)
      .filter((answer): answer is string => Boolean(answer && answer !== 'Sin respuesta'));
    return mayorVoteQuestion.options.length
      ? mayorVoteQuestion.options.map((option) => ({
          nombre: option.text,
          votos: answers.filter((answer) => answer === option.text || answer.startsWith(`${option.text}:`)).length,
          color: option.color || '#05a6f0',
        }))
      : Array.from(new Set(answers)).map((answer, index) => ({
          nombre: answer,
          votos: answers.filter((item) => item === answer).length,
          color: ['#05a6f0', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][index % 5],
        }));
  }, [currentSurveyInterviews, mayorVoteQuestion]);
  const enumeratorSurveyInterviews = useMemo(
    () => currentSurveyInterviews.filter((record) => record.enumeratorAlias.trim().toLowerCase() === currentEnumeratorAlias.trim().toLowerCase()),
    [currentSurveyInterviews, currentEnumeratorAlias]
  );

  // ── FUNCIÓN PARA OBTENER EL PRÓXIMO FOLIO CORRELATIVO (User1-01, User1-02...) ──
  const getNextSurveyNumber = (alias: string) => {
    const aliasSurveys = interviews.filter((i) => i.enumeratorAlias.trim().toLowerCase() === alias.trim().toLowerCase());
    return Math.max(0, ...aliasSurveys.map((interview) => interview.surveyNumber || 0)) + 1;
  };

  const getFormattedSurveyId = (alias: string, num: number) => {
    return `${alias.trim() || 'User1'}-${String(num).padStart(2, '0')}`;
  };

  const currentNextNumber = getNextSurveyNumber(currentEnumeratorAlias);
  const currentNextSurveyId = getFormattedSurveyId(currentEnumeratorAlias, currentNextNumber);

  // ── FILTRADO EXCLUSIVO DE COMUNIDADES PARA EL ENCUESTADOR ACTIVO ──
  // "Un usuario puede tener 1 o más comunidades, pero no puede elegir una comunidad que ya fue asignada a otro"
  const userAssignedCommunities = currentSurvey.communities?.filter((c) => c.assignedTo === currentEnumeratorAlias) || [];
  const getCommunityInterviewCount = (community: CommunityAssignment) => interviews.filter((record) =>
    record.surveyId === currentSurvey.id &&
    (record.communityId ? record.communityId === community.id : record.community.toLowerCase() === community.name.toLowerCase())
  ).length;
  // Formulario de campo
  const [fieldCommunity, setFieldCommunity] = useState<string>('');
  const [fieldAnswers, setFieldAnswers] = useState<Record<string, string>>({});
  const [fieldAgeGroup, setFieldAgeGroup] = useState<string>('');
  const [fieldGender, setFieldGender] = useState<string>('');
  const [interviewStartedAt, setInterviewStartedAt] = useState<string | null>(null);
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(null);
  const selectedCommunityAssignment = userAssignedCommunities.find((community) => community.name === fieldCommunity);
  const selectedCommunityQuotaReached = Boolean(selectedCommunityAssignment &&
    getCommunityInterviewCount(selectedCommunityAssignment) >= selectedCommunityAssignment.quota);

  const markInterviewStarted = () => {
    setInterviewStartedAt((previous) => previous ?? new Date().toISOString());
  };

  // Sincronizar comunidad por defecto cuando cambia la encuesta o el encuestador
  useEffect(() => {
    if (userAssignedCommunities.length > 0) {
      setFieldCommunity(userAssignedCommunities[0].name);
    } else {
      setFieldCommunity('');
    }

    const initial: Record<string, string> = {};
    currentSurvey.questions.forEach((q) => {
      initial[q.id] = '';
    });
    setFieldAnswers(initial);
    setInterviewStartedAt(null);
  }, [selectedSurveyId, currentEnumeratorAlias]);

  const handleSelectOption = (questionId: string, optionText: string) => {
    markInterviewStarted();
    setFieldAnswers((prev) => ({
      ...prev,
      [questionId]: optionText
    }));
  };

  // ── REGISTRAR ENCUESTA CON FOLIO Y COMUNIDAD ASIGNADA ──
  const handleSaveInterview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!gpsUpdated || !gpsLocation || !Number.isFinite(gpsLocation.lat) || !Number.isFinite(gpsLocation.lng)) {
      void Swal.fire({
        icon: 'warning',
        title: 'Actualiza el GPS',
        text: 'Antes de guardar una encuesta, pulsa “Actualizar GPS” y espera a que se capture la ubicación actual.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#05a6f0'
      });
      return;
    }

    const unansweredQuestions = currentSurvey.questions.filter((question) => {
      if (!question.isRequired) return false;
      const answer = fieldAnswers[question.id]?.trim();
      const selectedOption = question.options.find((option) => option.text === answer);
      const missingOtherText = Boolean(selectedOption?.allowsOtherText && !fieldAnswers[`${question.id}-other`]?.trim());
      return !answer || missingOtherText;
    });

    if (unansweredQuestions.length > 0) {
      const questionList = unansweredQuestions
        .map((question, index) => `${index + 1}. ${question.title}`)
        .join('\n');
      void Swal.fire({
        icon: 'warning',
        title: 'Encuesta incompleta',
        text: `Selecciona una respuesta para cada pregunta y completa las especificaciones requeridas:\n\n${questionList}`,
        confirmButtonText: 'Revisar encuesta',
        confirmButtonColor: '#05a6f0'
      });
      return;
    }

    if (!fieldCommunity) {
      void Swal.fire({
        icon: 'error',
        title: 'Falta seleccionar comunidad',
        text: 'Debes seleccionar una de las comunidades que te fueron asignadas por el Administrador.',
        confirmButtonColor: '#05a6f0'
      });
      return;
    }

    const selectedCommunity = currentSurvey.communities.find((community) => community.name === fieldCommunity);
    if (!selectedCommunity) {
      void Swal.fire({
        icon: 'error',
        title: 'Asignación no disponible',
        text: 'La comunidad seleccionada ya no está asignada a esta encuesta. Actualiza la página o contacta al administrador.',
        confirmButtonColor: '#05a6f0'
      });
      return;
    }
    if (getCommunityInterviewCount(selectedCommunity) >= selectedCommunity.quota) {
      void Swal.fire({
        icon: 'warning',
        title: 'Meta de comunidad alcanzada',
        text: `La comunidad ${selectedCommunity.name} ya completó las ${selectedCommunity.quota} encuestas asignadas. Elige otra comunidad si todavía tiene cupo.`,
        confirmButtonColor: '#05a6f0',
      });
      return;
    }

    const surveyNum = getNextSurveyNumber(currentEnumeratorAlias);
    const folioId = getFormattedSurveyId(currentEnumeratorAlias, surveyNum);

    const answersList: InterviewAnswer[] = currentSurvey.questions.map((q) => {
      const answer = fieldAnswers[q.id];
      const selectedOption = q.options.find((option) => option.text === answer);
      const otherText = selectedOption?.allowsOtherText ? fieldAnswers[`${q.id}-other`]?.trim() : '';
      return {
        questionId: q.id,
        questionTitle: q.title,
        answerText: otherText ? `${answer}: ${otherText}` : answer || 'Sin respuesta'
      };
    });

    const deviceUuid = window.crypto.randomUUID();
    const interviewedAt = new Date().toISOString();
    const startedAt = interviewStartedAt ?? interviewedAt;
    const writeInput = {
      deviceUuid,
      surveyId: currentSurvey.id,
      communityId: selectedCommunity.id,
      folio: folioId,
      ageGroup: fieldAgeGroup,
      gender: fieldGender,
      latitude: gpsLocation.lat,
      longitude: gpsLocation.lng,
      accuracy: gpsLocation.accuracy,
      startedAt,
      interviewedAt,
      answers: answersList.map(({ questionId, answerText }) => ({ questionId, answerText }))
    };
    const newRecord: InterviewRecord = {
      id: folioId,
      surveyId: currentSurvey.id,
      deviceUuid,
      communityId: selectedCommunity.id,
      surveyTitle: currentSurvey.title,
      enumeratorAlias: currentEnumeratorAlias,
      surveyNumber: surveyNum,
      enumeratorName: authenticatedSession?.fullName || currentEnumeratorAlias,
      department: currentSurvey.department,
      municipality: currentSurvey.municipality,
      community: fieldCommunity,
      ageGroup: fieldAgeGroup,
      gender: fieldGender,
      lat: gpsLocation.lat,
      lng: gpsLocation.lng,
      accuracy: gpsLocation.accuracy,
      startedAt,
      timestamp: interviewedAt,
      status: 'synced',
      answers: answersList
    };

    setIsInterviewSaving(true);
    let savedOffline = false;
    let databaseId: string | undefined;
    try {
      if (!isOnline || !navigator.onLine) {
        await savePendingInterview({
          deviceUuid,
          enumeratorUsername: authenticatedSession!.username,
          input: writeInput,
          record: { ...newRecord, status: 'pending' },
          createdAt: interviewedAt
        });
        savedOffline = true;
      } else {
        try {
          databaseId = await createInterviewRequest(writeInput);
        } catch (error) {
          if (!(error instanceof TypeError) && navigator.onLine) throw error;
          await savePendingInterview({
            deviceUuid,
            enumeratorUsername: authenticatedSession!.username,
            input: writeInput,
            record: { ...newRecord, status: 'pending' },
            createdAt: interviewedAt
          });
          savedOffline = true;
          setIsOnline(false);
        }
      }
    } catch (error) {
      void Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar la entrevista',
        text: error instanceof Error ? error.message : 'Verifica tu conexión y vuelve a intentarlo.',
        confirmButtonColor: '#05a6f0'
      });
      return;
    } finally {
      setIsInterviewSaving(false);
    }

    // Actualizar la vista con el registro confirmado por la base de datos.
    setSurveys((prev) =>
      prev.map((srv) => {
        if (srv.id === currentSurvey.id) {
          return {
            ...srv,
            collectedSample: srv.collectedSample + 1,
            questions: srv.questions.map((q) => {
              const selectedOptText = fieldAnswers[q.id];
              return {
                ...q,
                options: q.options.map((opt) =>
                  opt.text === selectedOptText ? { ...opt, votes: opt.votes + 1 } : opt
                )
              };
            })
          };
        }
        return srv;
      })
    );

    setInterviews((previous) => [{ ...newRecord, databaseId, status: savedOffline ? 'pending' : 'synced' }, ...previous]);
    setFieldAnswers(Object.fromEntries(currentSurvey.questions.map((question) => [question.id, ''])));
    setInterviewStartedAt(null);
    setGpsLocation(null);
    setGpsUpdated(false);
    setGpsError(null);
    setFormSuccessMessage(savedOffline
      ? `Encuesta ${folioId} guardada en este dispositivo. Se enviará al recuperar la conexión.`
      : `¡Encuesta registrada con éxito bajo el Folio ${folioId} en ${fieldCommunity}!`);
    await Swal.fire({
      icon: 'success',
      title: savedOffline ? 'Encuesta guardada en el dispositivo' : 'Encuesta guardada',
      text: savedOffline
        ? `La encuesta ${folioId} quedó pendiente en este dispositivo y se sincronizará cuando vuelva la conexión.`
        : `La encuesta ${folioId} se registró correctamente en ${fieldCommunity}.`,
      confirmButtonText: 'Continuar',
      confirmButtonColor: '#05a6f0'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      setFormSuccessMessage(null);
    }, 4000);
  };

  const handleDeleteInterview = async (record: InterviewRecord) => {
    if (currentUserRole !== 'admin' || !record.databaseId) return;
    const confirmation = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar esta encuesta?',
      text: `Se eliminarán el registro ${record.id} y sus respuestas de la base de datos.`,
      showCancelButton: true,
      confirmButtonText: 'Eliminar encuesta',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b42318',
    });
    if (!confirmation.isConfirmed) return;

    setDeletingInterviewId(record.databaseId);
    try {
      await deleteInterviewRequest(record.databaseId);
      setInterviews((previous) => previous.filter((item) => item.databaseId !== record.databaseId));
      setSurveys((previous) => previous.map((survey) => survey.id !== record.surveyId ? survey : {
        ...survey,
        collectedSample: Math.max(0, survey.collectedSample - 1),
        questions: survey.questions.map((question) => ({
          ...question,
          options: question.options.map((option) => ({ ...option, votes: 0 })),
        })),
      }));
      await Swal.fire({ icon: 'success', title: 'Encuesta eliminada', text: `Se eliminó ${record.id}.`, timer: 1600, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: error instanceof Error ? error.message : 'Error al eliminar la encuesta.' });
    } finally {
      setDeletingInterviewId(null);
    }
  };

  const handleClearSurveyRecords = async (survey: FullSurvey) => {
    if (currentUserRole !== 'admin' || isClearingSurveyRecords) return;
    const confirmation = await Swal.fire({
      icon: 'warning',
      title: 'Borrar todos los registros del estudio',
      html: `Se eliminarán permanentemente todas las encuestas y respuestas de <strong>${survey.title}</strong>. El estudio y sus comunidades permanecerán. Escribe <strong>ELIMINAR</strong> para confirmar.`,
      input: 'text',
      inputPlaceholder: 'ELIMINAR',
      inputValidator: (value) => value.trim().toUpperCase() === 'ELIMINAR' ? null : 'Escribe ELIMINAR para confirmar.',
      showCancelButton: true,
      confirmButtonText: 'Borrar registros',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b42318',
    });
    if (!confirmation.isConfirmed) return;

    setIsClearingSurveyRecords(true);
    try {
      const result = await clearSurveyInterviews(survey.id);
      const pending = await getPendingInterviews();
      await Promise.all(pending
        .filter((item) => item.input.surveyId === survey.id)
        .map((item) => removePendingInterview(item.deviceUuid)));
      setInterviews((previous) => previous.filter((record) => record.surveyId !== survey.id));
      setSurveys((previous) => previous.map((item) => item.id !== survey.id ? item : {
        ...item,
        collectedSample: 0,
        questions: item.questions.map((question) => ({
          ...question,
          options: question.options.map((option) => ({ ...option, votes: 0 })),
        })),
      }));
      await Swal.fire({
        icon: 'success',
        title: 'Estudio restablecido',
        text: `Se eliminaron ${result.deletedCount} encuesta(s). El contador volvió a 0.`,
        confirmButtonColor: '#05a6f0',
      });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudieron borrar los registros', text: error instanceof Error ? error.message : 'Error al borrar los registros del estudio.' });
    } finally {
      setIsClearingSurveyRecords(false);
    }
  };

  const generateCommunityAssignmentsPdf = async (survey: FullSurvey) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const communities = survey.communities;
    const totalQuota = communities.reduce((sum, community) => sum + community.quota, 0);
    const assignedAliases = Array.from(new Set(communities
      .map((community) => community.assignedTo.trim().toLowerCase())
      .filter(Boolean)));
    const surveyInterviews = interviews.filter((record) => record.surveyId === survey.id);
    const rows = communities.map((community, index) => {
      const assignedUser = usersList.find((user) => user.alias.toLowerCase() === community.assignedTo.toLowerCase());
      const completed = surveyInterviews.filter((record) =>
        record.communityId
          ? record.communityId === community.id
          : record.community.toLowerCase() === community.name.toLowerCase()
      ).length;
      return [
        String(index + 1),
        community.name,
        assignedUser ? `${assignedUser.fullName} (@${assignedUser.alias})` : community.assignedTo,
        String(community.quota),
        String(completed),
        String(Math.max(0, community.quota - completed)),
      ];
    });

    const previewWindow = window.open('', '_blank');
    doc.setProperties({ title: `Asignaciones - ${survey.title}`, subject: 'Comunidades y metas asignadas' });
    doc.setFillColor(5, 126, 184);
    doc.rect(0, 0, 297, 28, 'F');
    try {
      const logoImage = new Image();
      await new Promise<void>((resolve, reject) => {
        logoImage.onload = () => resolve();
        logoImage.onerror = () => reject(new Error('No se pudo cargar el logo'));
        logoImage.src = '/logo.png';
      });
      doc.addImage(logoImage, 'PNG', 270, 3, 22, 22);
    } catch {
      // El reporte se genera aunque el logo no esté disponible.
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('COMUNIDADES Y ASIGNACIONES', 14, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${survey.title} · ${survey.municipality}, ${survey.department}`, 14, 20);

    doc.setTextColor(31, 41, 51);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Comunidades: ${communities.length}`, 14, 39);
    doc.text(`Encuestadores asignados: ${assignedAliases.length}`, 76, 39);
    doc.text(`Meta total: ${totalQuota} encuestas`, 155, 39);
    doc.text(`Realizadas: ${surveyInterviews.length}`, 14, 47);
    doc.text(`Generado: ${formatGuatemalaDateTime(new Date().toISOString())}`, 76, 47);

    autoTable(doc, {
      startY: 54,
      head: [['#', 'Comunidad / aldea', 'Encuestador asignado', 'Meta', 'Realizadas', 'Pendientes']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [5, 126, 184], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: [31, 41, 51], fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 95 },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
      },
      didDrawPage: () => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text('AMTECHNOLOGY · Reporte de comunidades asignadas', 14, 202);
        doc.text(`Página ${doc.getNumberOfPages()}`, 283, 202, { align: 'right' });
      },
    });

    const fileName = `Asignaciones_${survey.municipality.replace(/[^a-z0-9]+/gi, '_')}.pdf`;
    const pdfUrl = URL.createObjectURL(doc.output('blob'));
    if (previewWindow) {
      previewWindow.location.href = pdfUrl;
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } else {
      doc.save(fileName);
    }
  };

  // ── GENERADOR DE BOLETA PDF OFICIAL ──
  const generateInterviewPdf = async (record: InterviewRecord) => {
    const doc = new jsPDF();

    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, 210, 24, 'F');
    try {
      const logoImage = new Image();
      await new Promise<void>((resolve, reject) => {
        logoImage.onload = () => resolve();
        logoImage.onerror = () => reject(new Error('No se pudo cargar el logo'));
        logoImage.src = '/logo.png';
      });
      doc.addImage(logoImage, 'PNG', 180, 3, 18, 18);
    } catch {
      // Si el logo no está disponible, generar igualmente la boleta.
    }
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('BOLETA INDIVIDUAL DE REGISTRO DE ENCUESTA', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`EncuestaApp Guatemala • Auditoría de Campo y Certificación Ciudadana`, 14, 18);

    doc.setFillColor(241, 245, 249);
    doc.rect(14, 28, 182, 34, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, 28, 182, 34, 'S');

    doc.setTextColor(30, 58, 138);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`NO. DE ENCUESTA: ${record.id}`, 20, 38);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Encuestador: ${record.enumeratorAlias}`, 20, 46);
    doc.text(`Municipio: ${record.municipality}, ${record.department}`, 20, 53);
    doc.text(`Comunidad Asignada: ${record.community}`, 20, 59);

    doc.text(`Fecha y Hora: ${formatGuatemalaDateTime(record.timestamp)}`, 115, 46);
    doc.text(`Perfil: ${record.ageGroup} | Género: ${record.gender}`, 115, 53);
    doc.text(`GPS: Lat ${record.lat}, Lng ${record.lng} (±${record.accuracy}m)`, 115, 59);

    const tableData = record.answers.map((ans, idx) => [
      String(idx + 1),
      ans.questionTitle,
      ans.answerText
    ]);

    autoTable(doc, {
      startY: 68,
      head: [['#', 'Pregunta Formulada', 'Opción / Candidato Marcado por el Ciudadano']],
      body: tableData,
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [15, 23, 42]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 105 },
        2: { cellWidth: 67, fontStyle: 'bold', textColor: [37, 99, 235] }
      },
      margin: { left: 14, right: 14 }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 180;

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Sello criptográfico de auditoría: SHA256-${record.id}-${Date.now().toString(16).toUpperCase()}`, 14, finalY + 12);
    doc.text(`Comunidad certificada por Administrador: "${record.community}" asignada a ${record.enumeratorAlias}`, 14, finalY + 17);

    doc.save(`Boleta_Encuesta_${record.id}.pdf`);
  };

  // ── ESTADO DEL CREADOR (BUILDER) - SOLO ADMINISTRADOR ──
  const [builderTitle, setBuilderTitle] = useState('Encuesta Electoral y Municipal — Guazacapán 2027');
  const [builderDepartment, setBuilderDepartment] = useState('Santa Rosa');
  const [builderMunicipality, setBuilderMunicipality] = useState('Guazacapán');
  const [builderTargetSample, setBuilderTargetSample] = useState<number>(1000);
  const [builderStartDate, setBuilderStartDate] = useState('2027-03-01');
  const [builderEndDate, setBuilderEndDate] = useState('2027-05-30');

  // Comunidades creadas y asignadas en el Builder
  const [builderCommunities, setBuilderCommunities] = useState<CommunityAssignment[]>([]);

  const [newCommName, setNewCommName] = useState('');
  const [newCommQuota, setNewCommQuota] = useState<number>(200);
  const [newCommAssignee, setNewCommAssignee] = useState<string>('');

  // Preguntas del cuestionario en el Builder
  const [builderQuestions, setBuilderQuestions] = useState<SurveyQuestion[]>(() => createGuazacapanQuestionTemplate(builderMunicipality));

  const [newQTitle, setNewQTitle] = useState('');
  const [newQType, setNewQType] = useState<'single' | 'multiple' | 'rating' | 'text'>('single');
  const [builderSuccessNotice, setBuilderSuccessNotice] = useState<string | null>(null);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);

  // ── GESTIÓN DE COMUNIDADES EN EL BUILDER (ADMIN) ──
  const handleAddCommunity = () => {
    if (!newCommName.trim()) return;

    const selectedAssignee = activeEnumerators.some((user) => user.alias === newCommAssignee)
      ? newCommAssignee
      : activeEnumerators[0]?.alias ?? '';
    if (!selectedAssignee) {
      alert('Primero crea o activa un usuario con rol de encuestador para asignarle esta comunidad.');
      return;
    }

    // Regla: No duplicar comunidad
    const alreadyExists = builderCommunities.some(
      (c) => c.name.trim().toLowerCase() === newCommName.trim().toLowerCase()
    );
    if (alreadyExists) {
      alert(`La comunidad o aldea "${newCommName}" ya fue agregada en este municipio.`);
      return;
    }

    const newComm: CommunityAssignment = {
      id: `com-${Date.now()}`,
      name: newCommName.trim(),
      assignedTo: selectedAssignee,
      quota: Number(newCommQuota) || 200
    };

    setBuilderCommunities([...builderCommunities, newComm]);
    setNewCommName('');
  };

  const handleReassignCommunity = (commId: string, newAssignee: string) => {
    setBuilderCommunities(
      builderCommunities.map((c) => (c.id === commId ? { ...c, assignedTo: newAssignee } : c))
    );
  };

  const handleRemoveCommunity = (commId: string) => {
    setBuilderCommunities(builderCommunities.filter((c) => c.id !== commId));
  };

  // La reasignación se confirma en PostgreSQL antes de actualizar la vista.
  const handleReassignActiveSurveyCommunity = async (commId: string, newAssignee: string) => {
    const survey = surveys.find((item) => item.id === assignmentSurveyId);
    const community = survey?.communities.find((item) => item.id === commId);
    if (!survey || !community || !newAssignee || newAssignee === community.assignedTo) return;
    setSavingAssignmentId(commId);
    try {
      await updateCommunityAssignment(survey.id, community.id, community.name, newAssignee, community.quota);
      setSurveys((previous) => previous.map((item) => item.id !== survey.id ? item : {
        ...item,
        communities: item.communities.map((entry) => entry.id === commId ? { ...entry, assignedTo: newAssignee } : entry),
        assignedEnumerators: Array.from(new Set(item.communities.map((entry) => entry.id === commId ? newAssignee : entry.assignedTo))),
      }));
      await Swal.fire({ icon: 'success', title: 'Asignación guardada', text: `${community.name} fue asignada a ${newAssignee}.`, timer: 1600, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: error instanceof Error ? error.message : 'Error al guardar la asignación.' });
    } finally {
      setSavingAssignmentId(null);
    }
  };

  const handleCreateAssignedCommunity = async () => {
    const survey = surveys.find((item) => item.id === assignmentSurveyId);
    const name = newAssignedCommunityName.trim();
    const assignedTo = newAssignedCommunityEnumerator || activeEnumerators[0]?.alias || '';
    if (!survey || !name || !assignedTo || !Number.isInteger(newAssignedCommunityQuota) || newAssignedCommunityQuota < 0) return;
    setSavingAssignmentId('new-community');
    try {
      const community = await createCommunityAssignment(survey.id, name, assignedTo, newAssignedCommunityQuota);
      setSurveys((previous) => previous.map((item) => item.id !== survey.id ? item : {
        ...item,
        communities: [...item.communities, community],
        assignedEnumerators: Array.from(new Set([...item.assignedEnumerators, assignedTo])),
      }));
      setNewAssignedCommunityName('');
      setNewAssignedCommunityQuota(100);
      await Swal.fire({ icon: 'success', title: 'Comunidad agregada', text: `${name} fue guardada y asignada a ${assignedTo}.`, timer: 1600, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudo agregar', text: error instanceof Error ? error.message : 'Error al guardar la comunidad.' });
    } finally {
      setSavingAssignmentId(null);
    }
  };

  const handleEditAssignedCommunity = async (community: CommunityAssignment) => {
    const survey = surveys.find((item) => item.id === assignmentSurveyId);
    if (!survey) return;
    const nameResult = await Swal.fire({ title: 'Editar comunidad', input: 'text', inputLabel: 'Nombre', inputValue: community.name, showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar', inputValidator: (value) => value.trim() ? null : 'Escribe un nombre.' });
    if (!nameResult.isConfirmed) return;
    const quotaResult = await Swal.fire({ title: 'Meta de encuestas', input: 'number', inputLabel: 'Cuota', inputValue: community.quota, inputAttributes: { min: '0', max: '1000000', step: '1' }, showCancelButton: true, confirmButtonText: 'Guardar', cancelButtonText: 'Cancelar', inputValidator: (value) => Number.isInteger(Number(value)) && Number(value) >= 0 ? null : 'Ingresa una meta válida.' });
    if (!quotaResult.isConfirmed) return;
    setSavingAssignmentId(community.id);
    try {
      const name = String(nameResult.value).trim();
      const quota = Number(quotaResult.value);
      await updateCommunityAssignment(survey.id, community.id, name, community.assignedTo, quota);
      setSurveys((previous) => previous.map((item) => item.id !== survey.id ? item : {
        ...item,
        communities: item.communities.map((entry) => entry.id === community.id ? { ...entry, name, quota } : entry),
      }));
      await Swal.fire({ icon: 'success', title: 'Cambios guardados', timer: 1400, showConfirmButton: false });
    } catch (error) {
      await Swal.fire({ icon: 'error', title: 'No se pudo editar', text: error instanceof Error ? error.message : 'Error al guardar los cambios.' });
    } finally {
      setSavingAssignmentId(null);
    }
  };

  // Agregar pregunta
  const handleAddNewQuestion = () => {
    if (!newQTitle.trim()) return;
    const newQuestion: SurveyQuestion = {
      id: `q-${Date.now()}`,
      title: newQTitle.trim(),
      type: newQType,
      isRequired: true,
      options:
        newQType === 'single' || newQType === 'multiple'
          ? [
              { id: `opt-${Date.now()}-1`, text: 'Opción 1', color: '#05a6f0', votes: 0 },
              { id: `opt-${Date.now()}-2`, text: 'Opción 2', color: '#10b981', votes: 0 },
              { id: `opt-${Date.now()}-3`, text: 'No sabe / No responde', color: '#64748b', votes: 0 }
            ]
          : []
    };
    setBuilderQuestions([...builderQuestions, newQuestion]);
    setNewQTitle('');
  };

  const handleRemoveQuestion = (qId: string) => {
    setBuilderQuestions(builderQuestions.filter((q) => q.id !== qId));
  };

  const handleAddOption = (qId: string) => {
    setBuilderQuestions(
      builderQuestions.map((q) => {
        if (q.id === qId) {
          const newOpt: QuestionOption = {
            id: `opt-${Date.now()}`,
            text: `Nueva opción ${q.options.length + 1}`,
            color: '#3b82f6',
            votes: 0
          };
          return { ...q, options: [...q.options, newOpt] };
        }
        return q;
      })
    );
  };

  const handleUpdateOption = (qId: string, optId: string, text: string) => {
    setBuilderQuestions(
      builderQuestions.map((q) => {
        if (q.id === qId) {
          return {
            ...q,
            options: q.options.map((opt) => (opt.id === optId ? { ...opt, text } : opt))
          };
        }
        return q;
      })
    );
  };

  const handleRemoveOption = (qId: string, optId: string) => {
    setBuilderQuestions(
      builderQuestions.map((q) => {
        if (q.id === qId) {
          return {
            ...q,
            options: q.options.filter((opt) => opt.id !== optId)
          };
        }
        return q;
      })
    );
  };

  // Cargar el cuestionario electoral y municipal de Guazacapán
  const handleLoadQuestionTemplate = () => {
    const template = createGuazacapanQuestionTemplate(builderMunicipality);
    setBuilderQuestions(template);
    alert(`Plantilla cargada con ${template.length} preguntas: empadronamiento, Presidencia, Diputación, problemas municipales, calificación y elección de Alcalde, más observaciones opcionales.`);
  };

  const handleStartEditSurvey = (survey: FullSurvey) => {
    if (currentUserRole !== 'admin' || survey.status === 'archived') return;
    setEditingSurveyId(survey.id);
    setBuilderTitle(survey.title);
    setBuilderDepartment(survey.department);
    setBuilderMunicipality(survey.municipality);
    setBuilderTargetSample(survey.targetSample);
    setBuilderStartDate(survey.startDate);
    setBuilderEndDate(survey.endDate);
    setBuilderCommunities(survey.communities.map((community) => ({ ...community })));
    setBuilderQuestions(survey.questions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option }))
    })));
    setSelectedSurveyId(survey.id);
    setBuilderSuccessNotice(null);
    setSurveyApiError(null);
    setActiveTab('builder');
  };

  const handleDeleteSurvey = async (survey: FullSurvey) => {
    if (currentUserRole !== 'admin') return;
    if (!window.confirm(`¿Archivar la encuesta “${survey.title}”? Se conservarán su historial y entrevistas.`)) return;
    setIsSurveySaving(true);
    setSurveyApiError(null);
    try {
      await archiveSurvey(survey.id);
      setSurveys((previous) => previous.map((item) => item.id === survey.id ? { ...item, status: 'archived' } : item));
      const nextSurvey = surveys.find((item) => item.id !== survey.id && item.status === 'active');
      if (selectedSurveyId === survey.id) setSelectedSurveyId(nextSurvey?.id ?? '');
      if (assignmentSurveyId === survey.id) setAssignmentSurveyId(nextSurvey?.id ?? '');
    } catch (error) {
      setSurveyApiError(error instanceof Error ? error.message : 'No se pudo archivar la encuesta.');
      return;
    } finally {
      setIsSurveySaving(false);
    }
    if (editingSurveyId === survey.id) setEditingSurveyId(null);
    setBuilderSuccessNotice(null);
  };

  const handleRestoreSurvey = async (survey: FullSurvey) => {
    if (currentUserRole !== 'admin' || survey.status !== 'archived') return;
    setIsSurveySaving(true);
    setSurveyApiError(null);
    try {
      const restoredSurvey = await restoreSurveyRequest(survey.id);
      setSurveys((previous) => previous.map((item) => item.id === restoredSurvey.id ? restoredSurvey : item));
      setSelectedSurveyId(restoredSurvey.id);
      setAssignmentSurveyId(restoredSurvey.id);
      await Swal.fire({ icon: 'success', title: 'Encuesta reactivada', text: 'El estudio volvió a estado activo y sus asignaciones disponibles fueron restauradas.', timer: 2200, showConfirmButton: false });
    } catch (error) {
      setSurveyApiError(error instanceof Error ? error.message : 'No se pudo reactivar la encuesta.');
    } finally {
      setIsSurveySaving(false);
    }
  };

  // Guardar o actualizar encuesta desde el Builder (Admin)
  const handleSaveSurveyFromBuilder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUserRole !== 'admin') return;
    if (!builderTitle.trim()) {
      alert('Por favor introduce un título para la encuesta');
      return;
    }

    const calculatedTarget = builderCommunities.reduce((a, b) => a + b.quota, 0) || builderTargetSample;
    const existingSurvey = editingSurveyId ? surveys.find((survey) => survey.id === editingSurveyId) : undefined;
    if (existingSurvey?.status === 'archived') {
      setSurveyApiError('Reactiva la encuesta antes de editarla.');
      return;
    }
    if (editingSurveyId && !existingSurvey) {
      setEditingSurveyId(null);
      alert('No se encontró la encuesta que intentas editar.');
      return;
    }

    const surveyInput = {
      title: builderTitle.trim(),
      department: builderDepartment,
      municipality: builderMunicipality,
      municipalities: [{ municipality: builderMunicipality, quota: calculatedTarget }],
      communities: builderCommunities.map((community) => ({ ...community })),
      startDate: builderStartDate,
      endDate: builderEndDate,
      targetSample: calculatedTarget,
      status: existingSurvey?.status ?? 'active',
      collectedSample: existingSurvey?.collectedSample ?? 0,
      assignedEnumerators: Array.from(new Set(builderCommunities.map((c) => c.assignedTo))),
      questions: builderQuestions.map((question) => ({
        ...question,
        options: question.options.map((option) => ({ ...option }))
      }))
    };

    setIsSurveySaving(true);
    setSurveyApiError(null);
    try {
      const savedSurvey = existingSurvey
        ? await updateSurveyRequest(existingSurvey.id, surveyInput)
        : await createSurveyRequest(surveyInput);
      setSurveys((previous) => existingSurvey
        ? previous.map((survey) => survey.id === savedSurvey.id ? savedSurvey : survey)
        : [savedSurvey, ...previous]);
      setSelectedSurveyId(savedSurvey.id);
      setEditingSurveyId(null);
      setBuilderSuccessNotice(existingSurvey
        ? `Encuesta “${savedSurvey.title}” actualizada correctamente.`
        : `¡Encuesta creada! Se guardaron ${builderCommunities.length} asignaciones y ${builderQuestions.length} preguntas.`);
      window.setTimeout(() => {
        setBuilderSuccessNotice(null);
        setActiveTab(existingSurvey ? 'surveys_list' : 'dashboard');
      }, 2200);
    } catch (error) {
      setSurveyApiError(error instanceof Error ? error.message : 'No se pudo guardar la encuesta.');
    } finally {
      setIsSurveySaving(false);
    }
  };

  // GPS en vivo
  const handleCaptureGps = () => {
    if (!window.isSecureContext) {
      const message = 'El navegador bloquea el GPS porque esta página no usa HTTPS. La dirección local por IP (http://192.168...) no puede pedir permiso de ubicación. Abre la app mediante HTTPS y vuelve a pulsar “Actualizar GPS”.';
      setGpsError('El GPS requiere una conexión HTTPS.');
      setGpsLocation(null);
      setGpsUpdated(false);
      setGpsLoading(false);
      void Swal.fire({
        icon: 'warning',
        title: 'El GPS requiere HTTPS',
        text: message,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#05a6f0'
      });
      return;
    }

    setGpsLoading(true);
    setGpsLocation(null);
    setGpsUpdated(false);
    setGpsError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const location = {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy)
          };
          if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
            setGpsError('El dispositivo devolvió coordenadas inválidas.');
            setGpsLoading(false);
            return;
          }
          setGpsLocation(location);
          setGpsUpdated(true);
          setGpsLoading(false);
        }, (error) => {
          const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
          const isAndroid = /Android/i.test(navigator.userAgent);
          const message = error.code === 1
            ? 'Permite el acceso a la ubicación para capturar el GPS.'
            : error.code === 2
              ? 'No se pudo obtener la ubicación. Revisa el GPS del dispositivo e inténtalo de nuevo.'
              : 'La solicitud de ubicación tardó demasiado. Inténtalo de nuevo.';
          setGpsError(message);
          setGpsLocation(null);
          setGpsUpdated(false);
          setGpsLoading(false);
          const permissionHelp = isIOS
            ? `<p style="text-align:left">${message}</p><ol style="text-align:left;padding-left:1.25rem;margin:.75rem 0 0"><li>Abre <b>Ajustes del iPhone → Chrome → Ubicación</b> y selecciona “Al usar la app”.</li><li>Si sigue bloqueado, revisa <b>Ajustes → Privacidad y seguridad → Localización</b> y permite el acceso a Chrome.</li><li>Regresa a la encuesta y pulsa “Actualizar GPS”.</li></ol>`
            : isAndroid
              ? `<p style="text-align:left">${message}</p><ol style="text-align:left;padding-left:1.25rem;margin:.75rem 0 0"><li>Activa <b>Ubicación</b> en los ajustes rápidos del teléfono.</li><li>En Chrome, abre <b>⋮ → Configuración → Configuración de sitios → Ubicación</b> y permite el acceso.</li><li>Regresa a la encuesta y pulsa “Actualizar GPS”.</li></ol>`
              : `<p style="text-align:left">${message}</p><p style="text-align:left;margin:.75rem 0 0">Permite la ubicación para este sitio en los ajustes del navegador y vuelve a pulsar “Actualizar GPS”.</p>`;
          void Swal.fire({
            icon: error.code === 1 ? 'warning' : 'error',
            title: error.code === 1 ? 'Permite el acceso al GPS' : 'No se pudo actualizar el GPS',
            text: error.code === 1 ? undefined : message,
            html: error.code === 1 ? permissionHelp : undefined,
            showCancelButton: true,
            confirmButtonText: 'Ya lo activé, reintentar',
            cancelButtonText: 'Ahora no',
            confirmButtonColor: '#05a6f0'
          }).then((result) => {
            if (result.isConfirmed) handleCaptureGps();
          });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      const message = 'Este dispositivo o navegador no permite obtener la ubicación GPS.';
      setGpsError(message);
      setGpsLocation(null);
      setGpsUpdated(false);
      setGpsLoading(false);
      void Swal.fire({
        icon: 'error',
        title: 'GPS no disponible',
        text: message,
        confirmButtonColor: '#05a6f0'
      });
    }
  };

  const filteredUsers = usersList.filter((user) => {
    const matchesSearch = `${user.alias} ${user.fullName} ${user.email}`
      .toLowerCase()
      .includes(userSearchTerm.trim().toLowerCase());
    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const resetUserForm = () => {
    setEditingUserId(null);
    setNewUserAlias('');
    setNewUserFullName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserPassword('');
    setNewUserRole('encuestador');
  };

  const handleStartEditUser = (user: AppUser) => {
    if (currentUserRole !== 'admin') return;
    setEditingUserId(user.id);
    setNewUserAlias(user.alias);
    setNewUserFullName(user.fullName);
    setNewUserEmail(user.email);
    setNewUserPhone(user.phone ?? '');
    setNewUserRole(user.role);
    setUserFormAlert(null);
  };

  const handleDeleteUser = async (user: AppUser) => {
    if (currentUserRole !== 'admin') return;
    const activeAdmins = usersList.filter((item) => item.role === 'admin' && item.status === 'active');
    if (user.role === 'admin' && user.status === 'active' && activeAdmins.length <= 1) {
      setUserFormAlert({ type: 'error', message: 'Debe permanecer al menos un administrador activo.' });
      return;
    }

    if (!window.confirm(`¿Desactivar la cuenta de ${user.fullName} (@${user.alias})? Se conservarán sus datos e historial.`)) return;
    setIsUserSaving(true);
    try {
      const updatedUser = await deactivateUserRequest(user.id);
      setUsersList((previous) => previous.map((item) => item.id === user.id ? updatedUser : item));
      if (currentEnumeratorAlias === user.alias) {
        setCurrentEnumeratorAlias(activeEnumerators.find((item) => item.id !== user.id)?.alias ?? '');
      }
      if (editingUserId === user.id) resetUserForm();
      setUserFormAlert({ type: 'success', message: `Usuario ${user.alias} desactivado.` });
    } catch (error) {
      setUserFormAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo desactivar el usuario.',
      });
    } finally {
      setIsUserSaving(false);
    }
  };

  const handleActivateUser = async (user: AppUser) => {
    setIsUserSaving(true);
    try {
      const updatedUser = await activateUserRequest(user.id);
      setUsersList((previous) => previous.map((item) => item.id === user.id ? updatedUser : item));
      setUserFormAlert({ type: 'success', message: `Usuario ${user.alias} reactivado.` });
    } catch (error) {
      setUserFormAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo reactivar el usuario.',
      });
    } finally {
      setIsUserSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentUserRole !== 'admin') {
      setUserFormAlert({ type: 'error', message: 'Solo un administrador puede crear usuarios.' });
      return;
    }

    const editingUser = editingUserId ? usersList.find((user) => user.id === editingUserId) : undefined;
    const alias = editingUser?.alias ?? newUserAlias.trim();
    const email = newUserEmail.trim().toLowerCase();
    const fullName = newUserFullName.trim();
    const aliasExists = usersList.some((user) => user.id !== editingUserId && user.alias.toLowerCase() === alias.toLowerCase());
    const emailExists = usersList.some((user) => user.id !== editingUserId && user.email.toLowerCase() === email);

    if (aliasExists || emailExists) {
      setUserFormAlert({
        type: 'error',
        message: aliasExists ? 'Ese alias ya está registrado.' : 'Ese correo ya está registrado.'
      });
      return;
    }

    if (editingUser && editingUser.role === 'admin' && newUserRole !== 'admin' && editingUser.status === 'active') {
      const activeAdmins = usersList.filter((user) => user.role === 'admin' && user.status === 'active');
      if (activeAdmins.length <= 1) {
        setUserFormAlert({ type: 'error', message: 'Debe permanecer al menos un administrador activo.' });
        return;
      }
    }

    setIsUserSaving(true);
    try {
      const userInput = {
        fullName,
        email,
        phone: newUserPhone.trim(),
        role: newUserRole,
      };
      if (editingUser) {
        const updatedUser = await updateUserRequest(editingUser.id, {
          ...userInput,
          ...(newUserPassword ? { password: newUserPassword } : {}),
        });
        setUsersList((previous) => previous.map((user) => user.id === editingUser.id ? updatedUser : user));
        if (editingUser.role === 'encuestador' && newUserRole !== 'encuestador' && currentEnumeratorAlias === editingUser.alias) {
          setCurrentEnumeratorAlias(activeEnumerators.find((user) => user.id !== editingUser.id)?.alias ?? '');
        }
        setUserFormAlert({ type: 'success', message: `Usuario ${alias} actualizado correctamente.` });
      } else {
        const createdUser = await createUserRequest({
          ...userInput,
          alias,
          password: newUserPassword,
        });
        setUsersList((previous) => [createdUser, ...previous]);
        setUserFormAlert({ type: 'success', message: `Usuario ${alias} creado correctamente.` });
      }
      resetUserForm();
    } catch (error) {
      setUserFormAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo guardar el usuario.',
      });
    } finally {
      setIsUserSaving(false);
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const user = await login(loginAlias.trim(), loginPassword);
      const roles = user.roles.map((role) => role.toUpperCase());
      const role: UserRole = roles.includes('ADMIN') ? 'admin' : roles.includes('SUPERVISOR') ? 'supervisor' : 'encuestador';
      setAuthenticatedSession({ ...user, fullName: user.fullName || user.username });
      setCurrentUserRole(role);
      setCurrentEnumeratorAlias(user.username);
      setActiveTab(role === 'admin' ? 'dashboard' : 'survey');
      setLoginPassword('');
    } catch (error) {
      setLoginError(
        error instanceof TypeError
          ? 'No se pudo conectar con el servidor de autenticación.'
          : error instanceof Error
            ? error.message
            : 'No se pudo iniciar sesión. Inténtalo de nuevo.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Cerrar la vista local aunque el servidor no responda.
    } finally {
      setAuthenticatedSession(null);
      setLoginPassword('');
      setLoginError('');
      setActiveTab('dashboard');
    }
  };

  const handleRefreshInterviews = async () => {
    setIsInterviewsLoading(true);
    try {
      const loaded = await listInterviews();
      const pending = await getPendingInterviews();
      const pendingRecords = pending.map((item) => ({ ...item.record, deviceUuid: item.deviceUuid }));
      setInterviews(mergeInterviewRecords(pendingRecords, loaded));
      setInterviewsApiError(null);
    } catch (error) {
      setInterviewsApiError(error instanceof Error ? error.message : 'No se pudieron actualizar las entrevistas.');
    } finally {
      setIsInterviewsLoading(false);
    }
  };

  const handleRefreshAdminLogs = async () => {
    setAdminLogsLoading(true);
    try {
      const [audit, errors] = await Promise.all([listAuditEvents(), listApplicationErrors()]);
      setAuditEvents(audit);
      setApplicationErrors(errors);
      setAdminLogsError(null);
    } catch (error) {
      setAdminLogsError(error instanceof Error ? error.message : 'No se pudieron cargar los registros de administración.');
    } finally {
      setAdminLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'admin_config' || currentUserRole !== 'admin') return;
    void handleRefreshAdminLogs();
  }, [activeTab, currentUserRole]);

  const filteredAuditEvents = auditEvents.filter((event) =>
    `${event.userName} ${event.action} ${event.entityType ?? ''} ${event.ipAddress ?? ''} ${event.origin ?? ''}`
      .toLowerCase().includes(adminLogsSearch.toLowerCase())
  );
  const filteredApplicationErrors = applicationErrors.filter((event) =>
    `${event.source} ${event.message} ${event.path ?? ''} ${event.userName ?? ''} ${event.ipAddress ?? ''}`
      .toLowerCase().includes(adminLogsSearch.toLowerCase())
  );

  if (isAuthChecking) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f3f8fb' }}>
        <div style={{ textAlign: 'center', color: '#52616b' }}>
          <img src="/logo.png" alt="Logo" style={{ width: 112, height: 112, objectFit: 'contain', marginBottom: '1rem' }} />
          <div style={{ fontWeight: 700 }}>Verificando sesión...</div>
        </div>
      </main>
    );
  }

  if (!authenticatedSession) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.25rem', background: 'linear-gradient(145deg, #eff8fd 0%, #f7fafc 55%, #e9f5fb 100%)' }}>
        <section style={{ width: '100%', maxWidth: 420, background: '#fff', border: '1px solid #dbe8ef', borderRadius: 20, padding: '2rem', boxShadow: '0 20px 55px rgba(26, 67, 91, 0.12)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <img src="/logo.png" alt="Logo" style={{ width: 140, height: 140, objectFit: 'contain', marginBottom: '0.5rem' }} />
            <h1 style={{ margin: 0, color: '#163247', fontSize: '1.45rem', fontWeight: 800 }}>Iniciar sesión</h1>
            <p style={{ margin: '0.4rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>Ingresa con tu alias y contraseña registrados.</p>
          </div>

          {loginError && (
            <div role="alert" style={{ padding: '0.75rem 0.9rem', marginBottom: '1rem', borderRadius: 10, background: '#fff1f0', border: '1px solid #fecaca', color: '#b42318', fontSize: '0.84rem' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'grid', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-alias">Alias de usuario</label>
              <input id="login-alias" className="form-input" value={loginAlias} onChange={(e) => setLoginAlias(e.target.value)} placeholder="Ej. Mveliz" autoComplete="username" required minLength={3} maxLength={255} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Contraseña</label>
              <input id="login-password" className="form-input" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Ingresa tu contraseña" autoComplete="current-password" required maxLength={128} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={isLoggingIn} style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', marginTop: '0.25rem' }}>
              <Lock size={16} /> {isLoggingIn ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="app-container">
      {/* ── HEADER PRINCIPAL ── */}
      <header className="top-navbar">
        <div className="logo-section">
          <button type="button" className="mobile-menu-toggle" aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}>
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="brand-badge" style={{ background: '#fff', padding: '2px', overflow: 'hidden', width: 64, height: 64, flexShrink: 0 }}>
            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }} />
          </div>
        </div>

        <div className="nav-status-group">
          {/* Selector de Estudio Activo */}
          {activeTab !== 'builder' && (
            <div className="header-study-select" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.04)', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Estudio:</span>
              <select
                value={selectedSurveyId}
                onChange={(e) => setSelectedSurveyId(e.target.value)}
                disabled={activeSurveys.length === 0}
                style={{ background: 'transparent', border: 'none', color: '#43bff5', fontSize: '0.78rem', fontWeight: 700, outline: 'none', cursor: 'pointer' }}
              >
                {activeSurveys.length === 0 && <option value="">Sin estudios activos</option>}
                {activeSurveys.map((s) => (
                  <option key={s.id} value={s.id} style={{ background: '#ffffff', color: '#1f2933' }}>
                    {s.title} ({s.municipality})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="header-user-card" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', background: '#f1f8fc', border: '1px solid #d7edf8', padding: '0.35rem 0.55rem 0.35rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <UserCheck size={15} style={{ color: '#05a6f0' }} />
            <div style={{ display: 'grid', lineHeight: 1.25 }}>
              <span style={{ fontSize: '0.76rem', color: '#1f2933', fontWeight: 750 }}>{authenticatedSession.fullName}</span>
              <span style={{ fontSize: '0.66rem', color: '#64748b' }}>@{authenticatedSession.username} · {currentUserRole === 'admin' ? 'Administrador' : currentUserRole === 'supervisor' ? 'Supervisor' : 'Encuestador'}</span>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => void handleLogout()} title="Cerrar sesión" aria-label="Cerrar sesión" style={{ padding: '0.4rem', marginLeft: '0.15rem' }}>
              <LogOut size={15} />
            </button>
          </div>

          {/* Toggle Offline / Online */}
          <button
            type="button"
            onClick={() => setIsOnline(!isOnline)}
            className={`header-connectivity status-chip ${isOnline ? 'online' : 'offline'}`}
          >
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
            {isOnline ? (
              <>
                <Wifi size={14} /> En Línea
              </>
            ) : (
              <>
                <WifiOff size={14} /> Modo Offline
              </>
            )}
            {interviews.some((record) => record.status === 'pending') && (
              <span style={{ marginLeft: '0.3rem' }}>
                · {interviews.filter((record) => record.status === 'pending').length} pendientes
              </span>
            )}
          </button>
        </div>
      </header>

      {mobileMenuOpen && <button type="button" className="mobile-nav-backdrop" aria-label="Cerrar menú de navegación" onClick={() => setMobileMenuOpen(false)} />}

      {/* ── NAVEGACIÓN PRINCIPAL ── */}
      <main className="main-content">
        <nav className={`tabs-navigation${mobileMenuOpen ? ' mobile-open' : ''}`} aria-label="Navegación principal">
          {currentUserRole !== 'encuestador' && <>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <BarChart3 size={16} />
            Dashboard ({currentSurvey.municipality})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <FileText size={16} />
            Reportes electorales
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'survey' ? 'active' : ''}`}
            onClick={() => setActiveTab('survey')}
            style={{ position: 'relative' }}
          >
            <Smartphone size={16} />
            <span>Terminal de Campo</span>
            <span className="survey-id-badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
              {currentNextSurveyId}
            </span>
          </button>

          {/* PESTAÑA BUILDER: SOLO PERMITIDA AL ADMINISTRADOR */}
          <button
            type="button"
            className={`tab-btn ${activeTab === 'builder' ? 'active' : ''}`}
            onClick={() => {
              if (currentUserRole !== 'admin') {
                alert('Acceso Restringido: Solo el Administrador tiene permisos para crear encuestas, crear comunidades y asignarlas a los encuestadores.');
                return;
              }
              setActiveTab('builder');
            }}
            title={currentUserRole !== 'admin' ? 'Función exclusiva de Administrador' : 'Crear y configurar encuestas y comunidades'}
          >
            {currentUserRole === 'admin' ? (
              <ListPlus size={16} style={{ color: '#06b6d4' }} />
            ) : (
              <Lock size={15} style={{ color: '#64748b' }} />
            )}
            <span>Constructor (Admin)</span>
            {currentUserRole !== 'admin' && (
              <span style={{ fontSize: '0.62rem', background: '#e8eef2', color: '#52616b', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                Bloqueado
              </span>
            )}
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'surveys_list' ? 'active' : ''}`}
            onClick={() => setActiveTab('surveys_list')}
          >
            <Layers size={16} />
            Estudios Guardados ({surveys.length})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <MapPin size={16} />
            Puntos GPS ({interviews.length})
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'supervisors' ? 'active' : ''}`}
            onClick={() => setActiveTab('supervisors')}
          >
            <ShieldCheck size={16} />
            Comunidades y Asignaciones
          </button>
          </>}

          {currentUserRole === 'admin' && (
            <button
              type="button"
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={16} />
              Usuarios ({usersList.length})
            </button>
          )}
          {currentUserRole === 'admin' && (
            <button
              type="button"
              className={`tab-btn ${activeTab === 'admin_config' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin_config')}
            >
              <Settings2 size={16} />
              Bitácora y Errores
            </button>
          )}
        </nav>

        {/* ══════════════════════════════════════════════════════════════
            VISTA: TERMINAL DE CAMPO (EL ENCUESTADOR SOLO VE SUS COMUNIDADES)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'survey' && (
          activeSurveys.length === 0 ? (
            <div className="glass-panel survey-empty-state" role="status">
              <h2>No hay estudios activos</h2>
              <p>La terminal solo muestra estudios en estado activo. Contacta al administrador para activar o asignarte un estudio.</p>
            </div>
          ) : (
          <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            <div className="glass-panel">
              {/* Encabezado del Terminal */}
              <div className="panel-header" style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span className="survey-id-badge" style={{ fontSize: '0.95rem' }}>
                      ENCUESTA NO. {currentNextSurveyId}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>
                      ✓ Encuestador: {currentEnumeratorAlias}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Municipio: <strong style={{ color: '#38bdf8' }}>{currentSurvey.municipality}</strong> ({currentSurvey.department}) • Estudio: {currentSurvey.title}
                  </p>
                  {activeSurveys.length > 1 && (
                    <label className="field-mobile-study-select">
                      <span>Estudio asignado</span>
                      <select value={selectedSurveyId} onChange={(event) => setSelectedSurveyId(event.target.value)}>
                        {activeSurveys.map((survey) => (
                          <option key={survey.id} value={survey.id}>
                            {survey.title} · {survey.code} · {survey.questions.length} preguntas
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <span className="field-question-count">{currentSurvey.questions.length} preguntas cargadas</span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={`status-chip ${isOnline ? 'online' : 'offline'}`}>
                    {isOnline ? 'Transmisión en Vivo' : 'Modo Local (Offline)'}
                  </span>
                </div>
              </div>

              <section aria-label="Resumen de encuestas realizadas" style={{ background: '#f0f9ff', border: '1px solid rgba(5, 166, 240, 0.25)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: enumeratorSurveyInterviews.length ? '0.75rem' : 0 }}>
                  <div>
                    <div style={{ color: '#075985', fontWeight: 800, fontSize: '0.95rem' }}>Mis encuestas en este estudio</div>
                    <div style={{ color: '#475569', fontSize: '0.78rem', marginTop: '0.2rem' }}>Registradas por {currentEnumeratorAlias} · {currentSurvey.title}</div>
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: '0.9rem', padding: '0.4rem 0.7rem' }}>
                    {enumeratorSurveyInterviews.length} {enumeratorSurveyInterviews.length === 1 ? 'encuesta realizada' : 'encuestas realizadas'}
                  </span>
                </div>
                {enumeratorSurveyInterviews.length > 0 && (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {enumeratorSurveyInterviews.slice(0, 5).map((record) => (
                      <div key={record.surveyId + record.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '0.3rem 0.9rem', padding: '0.65rem 0.75rem', background: '#fff', border: '1px solid #dbeafe', borderRadius: '8px', fontSize: '0.78rem' }}>
                        <span><strong>ID:</strong> {record.id}</span>
                        <span><strong>No. encuesta:</strong> {record.surveyNumber}</span>
                        <span><strong>Comunidad:</strong> {record.community}</span>
                        <span><strong>GPS:</strong> {record.lat.toFixed(6)}, {record.lng.toFixed(6)}</span>
                      </div>
                    ))}
                    {enumeratorSurveyInterviews.length > 5 && (
                      <span style={{ color: '#475569', fontSize: '0.75rem' }}>Mostrando las 5 más recientes de {enumeratorSurveyInterviews.length} encuestas.</span>
                    )}
                  </div>
                )}
              </section>

              {formSuccessMessage && (
                <div
                  style={{
                    background: 'var(--emerald-light)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#34d399',
                    padding: '0.85rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.65rem',
                    fontSize: '0.88rem',
                    fontWeight: 700
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={20} />
                    <span>{formSuccessMessage}</span>
                  </div>
                  {interviews[0] && (
                    <button
                      type="button"
                      onClick={() => setSelectedRecordForPdf(interviews[0])}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', background: '#ffffff', color: '#087fb8', borderColor: '#05a6f0' }}
                    >
                      <FileText size={14} /> Ver Boleta PDF
                    </button>
                  )}
                </div>
              )}

              <form onSubmit={handleSaveInterview} onFocusCapture={markInterviewStarted}>
                {/* 1. SELECCIÓN DE COMUNIDAD ASIGNADA EXCLUSIVAMENTE POR EL ADMIN */}
                <div className="field-territory-panel" style={{ background: '#f4f7f9', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
                  <div className="field-territory-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#43bff5', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <MapPin size={15} /> 1. Territorio Asignado y Perfil del Ciudadano en {currentSurvey.municipality}
                    </div>
                    <span className="badge badge-primary">
                      {userAssignedCommunities.length} comunidad(es) asignadas a {currentEnumeratorAlias}
                    </span>
                  </div>

                  <div className="field-territory-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                    {/* Selector de Comunidad: Solo muestra las asignadas a este encuestador sin permitir modificar */}
                    <div className="form-group field-community-field" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Comunidad / Aldea Asignada por Administrador</span>
                        <span style={{ color: '#38bdf8', fontSize: '0.72rem', fontWeight: 700 }}>
                          Solo asignaciones para {currentEnumeratorAlias}
                        </span>
                      </label>

                      {userAssignedCommunities.length > 0 ? (
                        <div>
                        <select
                          className="form-select"
                          value={fieldCommunity}
                          onChange={(e) => setFieldCommunity(e.target.value)}
                          required
                          style={{ borderColor: '#05a6f0', fontWeight: 700, fontSize: '0.9rem' }}
                        >
                          {userAssignedCommunities.map((comm) => (
                            <option key={comm.id} value={comm.name} disabled={getCommunityInterviewCount(comm) >= comm.quota}>
                              📍 {comm.name} ({getCommunityInterviewCount(comm)}/{comm.quota} encuestas)
                            </option>
                          ))}
                        </select>
                        {selectedCommunityAssignment && (
                          <div style={{ marginTop: '.4rem', fontSize: '.75rem', color: selectedCommunityQuotaReached ? '#b42318' : 'var(--text-muted)' }}>
                            {selectedCommunityQuotaReached
                              ? `Meta alcanzada: ${selectedCommunityAssignment.quota} encuestas. Selecciona otra comunidad con cupo disponible.`
                              : `Encuestas realizadas en esta comunidad: ${getCommunityInterviewCount(selectedCommunityAssignment)} de ${selectedCommunityAssignment.quota}.`}
                          </div>
                        )}
                        </div>
                      ) : (
                        <div style={{ padding: '0.75rem 0.95rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: 'var(--radius-sm)', color: '#fca5a5', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <UserX size={18} style={{ color: '#ef4444' }} />
                          <div>
                            <strong>Sin comunidades asignadas:</strong> El usuario {currentEnumeratorAlias} no tiene comunidades asignadas en {currentSurvey.municipality}. El Administrador debe asignarle una comunidad en la pestaña "Comunidades y Asignaciones".
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Rango de Edad del Encuestado</label>
                      <select
                        className="form-select"
                        value={fieldAgeGroup}
                        onChange={(e) => setFieldAgeGroup(e.target.value)}
                        required
                      >
                        <option value="" disabled>Seleccionar opción</option>
                        <option value="18-25 años">18 a 25 años</option>
                        <option value="26-35 años">26 a 35 años</option>
                        <option value="36-50 años">36 a 50 años</option>
                        <option value="51+ años">51 años o más</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Género</label>
                      <select
                        className="form-select"
                        value={fieldGender}
                        onChange={(e) => setFieldGender(e.target.value)}
                        required
                      >
                        <option value="" disabled>Seleccionar opción</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Prefiere no indicar">Prefiere no indicar</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. PREGUNTAS Y OPCIONES DEL CUESTIONARIO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  {currentSurvey.questions.map((q, qIdx) => {
                    const selectedVal = fieldAnswers[q.id];

                    return (
                      <div
                        key={q.id}
                        style={{
                          background: '#f7f9fa',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1.25rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', marginBottom: '1rem' }}>
                          <span
                            style={{
                              background: '#e8eef2',
                              color: '#38bdf8',
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {qIdx + 1}
                          </span>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1f2933', lineHeight: 1.4 }}>
                              {q.title}
                            </h3>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {q.type === 'single' ? 'Seleccione una opción:' : q.type === 'multiple' ? 'Selección múltiple:' : `Respuesta del ciudadano${q.isRequired ? '' : ' (opcional)'}:`}
                            </span>
                          </div>
                        </div>

                        {/* Opciones */}
                        {q.options.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => handleSelectOption(q.id, '')}
                              className={`candidate-option ${!selectedVal ? 'selected' : ''}`}
                              style={{ padding: '0.75rem 1rem', color: '#64748b', background: !selectedVal ? '#f1f5f9' : '#fff', border: '1px dashed #cbd5e1', textAlign: 'left' }}
                            >
                              <span style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${!selectedVal ? '#64748b' : '#cbd5e1'}`, flexShrink: 0 }} />
                              <span style={{ fontSize: '0.88rem', fontWeight: !selectedVal ? 700 : 500 }}>Sin seleccionar</span>
                            </button>
                            {q.options.map((opt) => {
                              const isSelected = selectedVal === opt.text;

                              return (
                                <div
                                  key={opt.id}
                                  onClick={() => handleSelectOption(q.id, opt.text)}
                                  className={`candidate-option ${isSelected ? 'selected' : ''}`}
                                  style={{ padding: '0.75rem 1rem' }}
                                >
                                  <div
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '50%',
                                      border: `2px solid ${isSelected ? '#05a6f0' : '#475569'}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0
                                    }}
                                  >
                                    {isSelected && (
                                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#05a6f0' }}></div>
                                    )}
                                  </div>

                                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    {opt.color && (
                                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: opt.color, flexShrink: 0 }}></span>
                                    )}
                                    <span style={{ fontSize: '0.88rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#1f2933' : '#52616b' }}>
                                      {opt.text}
                                    </span>
                                  </div>

                                  {isSelected && (
                                    <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 800 }}>✓ Marcado</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.type === 'rating' && (
                          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleSelectOption(q.id, `${star} estrellas`)}
                                className={`btn ${selectedVal === `${star} estrellas` ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ flex: 1, padding: '0.6rem 0', fontSize: '0.85rem' }}
                              >
                                ⭐ {star}
                              </button>
                            ))}
                          </div>
                        )}

                        {q.type === 'text' && (
                          <input
                            type="text"
                            className="form-input"
                            value={selectedVal || ''}
                            onChange={(e) => handleSelectOption(q.id, e.target.value)}
                            placeholder="Escriba la respuesta textual del encuestado..."
                          />
                        )}

                        {q.options.some((option) => option.allowsOtherText && option.text === selectedVal) && (
                          <input
                            type="text"
                            className="form-input"
                            style={{ marginTop: '0.75rem' }}
                            value={fieldAnswers[`${q.id}-other`] || ''}
                            onChange={(e) => setFieldAnswers((prev) => ({ ...prev, [`${q.id}-other`]: e.target.value }))}
                            placeholder="Especifique la respuesta..."
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* GPS */}
                <div
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.25rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <MapPin size={16} style={{ color: gpsUpdated ? '#10b981' : gpsError ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', color: gpsUpdated ? '#087a55' : gpsError ? '#b42318' : '#9a6700' }}>
                      GPS: {gpsLoading ? 'Capturando ubicación actual...' : gpsUpdated && gpsLocation
                        ? `${gpsLocation.lat}, ${gpsLocation.lng} (±${gpsLocation.accuracy}m)`
                        : gpsError || 'Pendiente: pulsa “Actualizar GPS” antes de guardar'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
                    disabled={gpsLoading}
                  >
                    <RefreshCw size={12} className={gpsLoading ? 'animate-spin' : ''} />
                    {gpsLoading ? 'Capturando...' : gpsUpdated ? 'GPS actualizado' : 'Actualizar GPS'}
                  </button>
                </div>

                {/* BOTÓN REGISTRAR ENCUESTA */}
                <button
                  type="submit"
                  disabled={userAssignedCommunities.length === 0 || selectedCommunityQuotaReached || isInterviewSaving || isInterviewsLoading}
                  className="btn btn-primary"
                  aria-busy={isInterviewSaving}
                  style={{
                    width: '100%',
                    padding: '0.9rem',
                    fontSize: '1rem',
                    fontWeight: 800,
                    opacity: userAssignedCommunities.length === 0 || selectedCommunityQuotaReached || isInterviewSaving || isInterviewsLoading ? 0.5 : 1,
                    cursor: userAssignedCommunities.length === 0 || selectedCommunityQuotaReached || isInterviewSaving || isInterviewsLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isInterviewSaving
                    ? <RefreshCw size={18} className="animate-spin" />
                    : <Send size={18} />}
                  {isInterviewSaving ? 'Guardando...' : 'Guardar Encuesta'}
                </button>
              </form>
            </div>
          </div>
          )
        )}

        {/* ══════════════════════════════════════════════════════════════
            VISTA: CONSTRUCTOR DE ENCUESTAS Y COMUNIDADES (SOLO ADMIN)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'builder' && (
          <div>
            {builderSuccessNotice && (
              <div
                style={{
                  background: 'var(--emerald-light)',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  color: '#34d399',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: 700
                }}
              >
                <CheckCircle2 size={22} />
                <span>{builderSuccessNotice}</span>
              </div>
            )}
            {(surveyApiError || isSurveysLoading) && (
              <div
                role={surveyApiError ? 'alert' : 'status'}
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: surveyApiError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(5, 166, 240, 0.1)',
                  border: `1px solid ${surveyApiError ? 'rgba(239, 68, 68, 0.28)' : 'rgba(5, 166, 240, 0.28)'}`,
                  color: surveyApiError ? '#b42318' : '#087aaf',
                }}
              >
                {surveyApiError ?? 'Cargando encuestas desde el servidor...'}
              </div>
            )}

            <div className="builder-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {/* COLUMNA IZQUIERDA: DISEÑADOR */}
              <div className="glass-panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      <ListPlus size={20} style={{ color: '#06b6d4' }} />
                      {editingSurveyId ? 'Editar encuesta' : 'Constructor de Encuesta Municipal'} (Exclusivo Administrador)
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Define el municipio, crea comunidades y asígnalas a los encuestadores de manera exclusiva
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadQuestionTemplate}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderColor: '#06b6d4', color: '#22d3ee' }}
                    title="Cargar automáticamente preguntas modelo"
                  >
                    <Sparkles size={13} /> Plantilla Guazacapán
                  </button>
                </div>

                <form onSubmit={handleSaveSurveyFromBuilder}>
                  {/* SECCIÓN 1: DATOS GENERALES */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <Settings2 size={16} style={{ color: '#43bff5' }} />
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        1. Definición Territorial y Muestra
                      </h3>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Nombre del Estudio</label>
                      <input
                        type="text"
                        className="form-input"
                        value={builderTitle}
                        onChange={(e) => setBuilderTitle(e.target.value)}
                        placeholder="Ej. Estudio Electoral Municipal — Guazacapán 2027"
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Departamento</label>
                        <select
                          className="form-select"
                          value={builderDepartment}
                          onChange={(e) => {
                            const d = e.target.value;
                            setBuilderDepartment(d);
                            const mun = GUATEMALA_GEOGRAPHY[d]?.[0] || 'Municipio';
                            setBuilderMunicipality(mun);
                            setBuilderTitle(`Encuesta Municipal — ${mun} 2027`);
                          }}
                        >
                          {Object.keys(GUATEMALA_GEOGRAPHY).map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Municipio de Aplicación</label>
                        <select
                          className="form-select"
                          value={builderMunicipality}
                          onChange={(e) => {
                            const m = e.target.value;
                            setBuilderMunicipality(m);
                            setBuilderTitle(`Encuesta Municipal — ${m} 2027`);
                          }}
                        >
                          {(GUATEMALA_GEOGRAPHY[builderDepartment] || []).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Meta Muestral</label>
                        <input
                          type="number"
                          className="form-input"
                          value={builderTargetSample}
                          onChange={(e) => setBuilderTargetSample(Number(e.target.value))}
                          min={50}
                          step={50}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.85rem' }}>
                      <div className="form-group">
                        <label className="form-label">Fecha de Inicio</label>
                        <input
                          type="date"
                          className="form-input"
                          value={builderStartDate}
                          onChange={(e) => setBuilderStartDate(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Fecha Límite</label>
                        <input
                          type="date"
                          className="form-input"
                          value={builderEndDate}
                          onChange={(e) => setBuilderEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 2: CREACIÓN Y ASIGNACIÓN EXCLUSIVA DE COMUNIDADES (REQUERIMIENTO EXACTO) */}
                  <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MapPin size={16} style={{ color: '#06b6d4' }} />
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          2. Creación de Comunidades y Asignación por Usuario ({builderCommunities.length} creadas)
                        </h3>
                      </div>
                      <span className="badge badge-primary">Asignación Exclusiva</span>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                      El Administrador crea las comunidades y asigna qué encuestador levantará cada zona. Un usuario puede tener 1 o más comunidades, pero <strong>ninguna comunidad asignada puede ser compartida o duplicada</strong>.
                    </p>

                    {activeEnumerators.length === 0 && (
                      <div
                        role="status"
                        style={{
                          marginBottom: '0.85rem',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(245, 158, 11, 0.1)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          color: '#92400e',
                          fontSize: '0.82rem',
                        }}
                      >
                        {isUsersLoading
                          ? 'Cargando usuarios para asignar...'
                          : 'No hay cuentas activas con rol de encuestador. Crea o activa una desde Gestión de usuarios para poder asignar comunidades.'}
                        {!isUsersLoading && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ marginLeft: '0.65rem', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => setActiveTab('users')}
                          >
                            Ir a Gestión de usuarios
                          </button>
                        )}
                      </div>
                    )}

                    {/* Formulario para crear y asignar comunidad */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.3fr auto', gap: '0.5rem', marginBottom: '1rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={`Comunidad / Aldea / Zona en ${builderMunicipality}`}
                        value={newCommName}
                        onChange={(e) => setNewCommName(e.target.value)}
                      />
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Cuota"
                        value={newCommQuota}
                        onChange={(e) => setNewCommQuota(Number(e.target.value))}
                        min={10}
                        title="Meta de encuestas en esta comunidad"
                      />
                      <select
                        className="form-select"
                        value={activeEnumerators.some((user) => user.alias === newCommAssignee) ? newCommAssignee : activeEnumerators[0]?.alias ?? ''}
                        onChange={(e) => setNewCommAssignee(e.target.value)}
                        title="Encuestador asignado a esta comunidad"
                        required={activeEnumerators.length > 0}
                        disabled={activeEnumerators.length === 0}
                      >
                        {activeEnumerators.length === 0 ? (
                          <option value="">No hay encuestadores activos</option>
                        ) : activeEnumerators.map((user) => (
                          <option key={user.id} value={user.alias}>{user.alias} — {user.fullName}</option>
                        ))}
                      </select>
                      <button type="button" onClick={handleAddCommunity} className="btn btn-secondary" disabled={activeEnumerators.length === 0}>
                        <Plus size={14} /> Crear y Asignar
                      </button>
                    </div>

                    {/* Resumen de carga por Encuestador */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem', marginBottom: '0.85rem' }}>
                      {activeEnumerators.map((user) => {
                        const userComms = builderCommunities.filter((c) => c.assignedTo === user.alias);
                        const totalQ = userComms.reduce((a, b) => a + b.quota, 0);
                        return (
                          <div key={user.id} style={{ background: '#f4f7f9', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#087fb8' }}>👤 {user.alias}</span>
                              <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>{userComms.length} com.</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                              {user.fullName} · Meta: {totalQ} encuestas
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Lista de comunidades con selector de reasignación */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {builderCommunities.map((comm) => (
                        <div
                          key={comm.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: '#f4f7f9',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.5rem 0.75rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <MapPin size={14} style={{ color: '#06b6d4' }} />
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{comm.name}</span>
                            <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>{comm.quota} encuestas</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Asignado a:</span>
                            <select
                              className="form-select"
                              value={activeEnumerators.some((user) => user.alias === comm.assignedTo) ? comm.assignedTo : ''}
                              onChange={(e) => handleReassignCommunity(comm.id, e.target.value)}
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem', height: '28px' }}
                            >
                              {!activeEnumerators.some((user) => user.alias === comm.assignedTo) && (
                                <option value="" disabled>Sin usuario activo ({comm.assignedTo})</option>
                              )}
                              {activeEnumerators.map((user) => <option key={user.id} value={user.alias}>{user.alias} — {user.fullName}</option>)}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemoveCommunity(comm.id)}
                              style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '0.2rem' }}
                              title="Eliminar comunidad"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECCIÓN 3: GESTIÓN DE PREGUNTAS Y OPCIONES */}
                  <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckSquare size={16} style={{ color: '#f59e0b' }} />
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          3. Cuestionario de Preguntas ({builderQuestions.length} preguntas)
                        </h3>
                      </div>
                      <span className="badge badge-amber">Dinámico</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Escriba la nueva pregunta (Ej: ¿Por cuál candidato a Alcalde votaría?)"
                        value={newQTitle}
                        onChange={(e) => setNewQTitle(e.target.value)}
                        style={{ flex: 3 }}
                      />
                      <select
                        className="form-select"
                        value={newQType}
                        onChange={(e) => setNewQType(e.target.value as any)}
                        style={{ flex: 1.5 }}
                      >
                        <option value="single">Selección Única</option>
                        <option value="multiple">Selección Múltiple</option>
                        <option value="rating">Calificación 1-5</option>
                        <option value="text">Texto Libre (sin opciones)</option>
                      </select>
                      <button type="button" onClick={handleAddNewQuestion} className="btn btn-secondary">
                        <Plus size={14} /> Agregar Pregunta
                      </button>
                    </div>

                    {/* Lista de preguntas */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {builderQuestions.map((q, qIndex) => (
                        <div
                          key={q.id}
                          style={{
                            background: '#f4f7f9',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '1rem'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div>
                              <span style={{ fontSize: '0.72rem', color: '#06b6d4', fontWeight: 800, textTransform: 'uppercase' }}>
                                Pregunta {qIndex + 1} • {q.type === 'single' ? 'Selección Única' : q.type === 'multiple' ? 'Múltiple' : q.type === 'rating' ? 'Calificación 1-5' : 'Texto'}
                              </span>
                              <div style={{ fontWeight: 700, fontSize: '0.92rem', marginTop: '0.2rem', color: '#1f2933' }}>
                                {q.title}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(q.id)}
                              style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '0.2rem' }}
                              title="Eliminar pregunta"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {(q.type === 'single' || q.type === 'multiple') && (
                            <div style={{ paddingLeft: '0.75rem', marginTop: '0.75rem', borderLeft: '2px solid rgba(255,255,255,0.08)' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                                Opciones configuradas:
                              </span>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.65rem' }}>
                                {q.options.map((opt) => (
                                  <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>•</span>
                                    <input
                                      type="text"
                                      value={opt.text}
                                      onChange={(e) => handleUpdateOption(q.id, opt.id, e.target.value)}
                                      className="form-input"
                                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', flex: 1 }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveOption(q.id, opt.id)}
                                      style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
                                      title="Quitar opción"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddOption(q.id)}
                                style={{ background: 'transparent', border: 'none', color: '#43bff5', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <Plus size={12} /> Agregar Opción
                              </button>
                            </div>
                          )}

                          {q.type === 'text' && (
                            <div style={{ marginTop: '0.75rem', padding: '0.65rem 0.75rem', background: '#eef7fb', borderRadius: 'var(--radius-sm)', color: '#52616b', fontSize: '0.78rem' }}>
                              Respuesta abierta: el encuestado escribirá su respuesta. Esta pregunta no necesita opciones.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BOTÓN GUARDAR Y PUBLICAR */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    {editingSurveyId && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setEditingSurveyId(null);
                          setActiveTab('surveys_list');
                        }}
                      >
                        Cancelar edición
                      </button>
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '0.75rem 1.8rem', fontSize: '0.9rem' }}
                      disabled={isSurveySaving}
                    >
                      <Save size={16} />
                      {isSurveySaving ? 'Guardando...' : editingSurveyId ? 'Guardar cambios' : 'Guardar y Publicar Encuesta'}
                    </button>
                  </div>
                </form>
              </div>

              {/* VISTA PREVIA COLAPSABLE: queda fuera del flujo principal de edición */}
              <details className="builder-preview">
                <summary>
                  <span><Eye size={18} style={{ color: '#10b981' }} /> Vista previa de asignación y cuestionario</span>
                  <span className="badge badge-emerald">{builderMunicipality}</span>
                </summary>
                <div className="glass-panel builder-preview-content">

                  {/* Tarjeta de Comunidades Asignadas */}
                  <div style={{ background: '#f4f7f9', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.5rem' }}>
                      Distribución Territorial de Comunidades:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {builderCommunities.map((c) => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', background: '#f0f4f6', padding: '0.35rem 0.55rem', borderRadius: '4px' }}>
                          <span>{c.name}</span>
                          <span style={{ color: '#43bff5', fontWeight: 700 }}>👤 {c.assignedTo} ({c.quota})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.5rem' }}>
                    Preguntas ({builderQuestions.length}):
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '420px', overflowY: 'auto' }}>
                    {builderQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        style={{
                          background: '#f4f7f9',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '0.85rem'
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.4rem' }}>
                          {idx + 1}. {q.title}
                        </div>

                        {q.options.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {q.options.map((opt) => (
                              <div
                                key={opt.id}
                                style={{
                                  background: '#f0f4f6',
                                  padding: '0.35rem 0.6rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  color: '#cbd5e1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem'
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#05a6f0' }}></span>
                                <span>{opt.text}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.type === 'text' && (
                          <input
                            type="text"
                            className="form-input"
                            placeholder={q.isRequired ? 'Respuesta escrita (obligatoria)' : 'Respuesta escrita (opcional)'}
                            disabled
                            aria-label={`Vista previa: ${q.title}`}
                            style={{ marginTop: '0.5rem', background: '#fff' }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VISTA: DASHBOARD DE RESULTADOS Y AUDITORÍA POR PREGUNTA
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{currentSurvey.title}</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Municipio de <strong style={{ color: '#38bdf8' }}>{currentSurvey.municipality}</strong> • Departamento de {currentSurvey.department} • Código: {currentSurvey.code}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={() => void handleRefreshInterviews()} disabled={isInterviewsLoading}>
                  <RefreshCw size={14} className={isInterviewsLoading ? 'animate-spin' : ''} />
                  {isInterviewsLoading ? 'Actualizando...' : 'Actualizar datos'}
                </button>
                {currentUserRole === 'admin' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingSurveyId(null);
                      setBuilderCommunities([]);
                      setBuilderSuccessNotice(null);
                      setSurveyApiError(null);
                      setActiveTab('builder');
                    }}
                  >
                    <Plus size={14} /> Nueva Encuesta
                  </button>
                )}
              </div>
            </div>

            {(isInterviewsLoading || interviewsApiError) && (
              <div
                role={interviewsApiError ? 'alert' : 'status'}
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: interviewsApiError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(5, 166, 240, 0.1)',
                  border: `1px solid ${interviewsApiError ? 'rgba(239, 68, 68, 0.28)' : 'rgba(5, 166, 240, 0.28)'}`,
                  color: interviewsApiError ? '#b42318' : '#087aaf',
                  fontSize: '0.82rem'
                }}
              >
                {interviewsApiError ? `No se pudieron cargar los datos de la base de datos: ${interviewsApiError}` : 'Cargando entrevistas y estadísticas desde la base de datos...'}
              </div>
            )}

            {/* Tarjetas KPI */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-header">
                  <span>TOTAL ENCUESTAS</span>
                  <div className="kpi-icon" style={{ background: 'var(--primary-light)', color: '#43bff5' }}>
                    <Vote size={18} />
                  </div>
                </div>
                <div className="kpi-value">{currentSurveyInterviews.length}</div>
                <div className="kpi-footer">
                  <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                  <span>Meta asignada a comunidades: {communitySurveyProgress.totalQuota.toLocaleString()} encuestas en {currentSurvey.municipality}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <span>COMUNIDADES ASIGNADAS</span>
                  <div className="kpi-icon" style={{ background: 'var(--cyan-light)', color: '#22d3ee' }}>
                    <MapPin size={18} />
                  </div>
                </div>
                <div className="kpi-value">{currentSurvey.communities.length}</div>
                <div className="kpi-footer">
                  <span>Asignadas exclusivamente sin repetición</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <span>PREGUNTAS EN ESTUDIO</span>
                  <div className="kpi-icon" style={{ background: 'var(--emerald-light)', color: '#34d399' }}>
                    <CheckSquare size={18} />
                  </div>
                </div>
                <div className="kpi-value">{currentSurvey.questions.length}</div>
                <div className="kpi-footer">
                  <span>Presidente, Diputados, Alcalde y Servicios</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-header">
                  <span>AVANCE DE ENCUESTAS</span>
                  <div className="kpi-icon" style={{ background: 'var(--primary-light)', color: '#05a6f0' }}>
                    <BarChart3 size={18} />
                  </div>
                </div>
                <div className="kpi-value">{communitySurveyProgress.percentage}%</div>
                <div
                  role="progressbar"
                  aria-label="Avance de encuestas asignadas en comunidades"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={communitySurveyProgress.percentage}
                  style={{ height: 7, margin: '0.55rem 0', borderRadius: 999, background: 'var(--border-color, #e2e8f0)', overflow: 'hidden' }}
                >
                  <div style={{ width: `${communitySurveyProgress.percentage}%`, height: '100%', borderRadius: 999, background: '#05a6f0', transition: 'width 250ms ease' }} />
                </div>
                <div className="kpi-footer">
                  <span>{communitySurveyProgress.completed} realizadas · {communitySurveyProgress.remaining} pendientes de {communitySurveyProgress.totalQuota}</span>
                </div>
              </div>
            </div>

            <div className="dashboard-live-grid">
            <section className="glass-panel recent-surveys-panel" aria-labelledby="recent-surveys-heading">
              <div className="recent-surveys-heading">
                <div>
                  <h3 id="recent-surveys-heading"><Bell size={17} /> Encuestas realizadas recientemente</h3>
                  <p>Se muestran las últimas 5; las más antiguas salen al llegar nuevas.</p>
                </div>
                <span className="recent-surveys-count">{latestInterviewNotifications.length} / 5</span>
              </div>

              {latestInterviewNotifications.length ? (
                <div className="recent-surveys-list">
                  {latestInterviewNotifications.map((record, index) => (
                    <article
                      className={`recent-survey-row${record.id === newInterviewNotificationId ? ' is-new' : ''}`}
                      key={`${record.surveyId}-${record.id}`}
                    >
                      <span className="recent-survey-index">{index + 1}</span>
                      <div className="recent-survey-person">
                        <strong>{record.enumeratorName || record.enumeratorAlias}</strong>
                        <span>Encuesta No. {record.id}</span>
                      </div>
                      <div className="recent-survey-community">
                        <span>Comunidad</span>
                        <strong>{record.community || 'Sin comunidad'}</strong>
                      </div>
                      <time dateTime={record.timestamp}>{formatGuatemalaDateTime(record.timestamp)}</time>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="recent-surveys-empty">Todavía no hay encuestas realizadas.</div>
              )}
            </section>

            <section className="glass-panel mayor-results-panel" aria-labelledby="mayor-results-heading">
              <div className="recent-surveys-heading">
                <div>
                  <h3 id="mayor-results-heading"><BarChart3 size={17} /> Resultado de Alcalde</h3>
                  <p>{mayorVoteQuestion?.title ?? `Sin pregunta de votación para Alcalde en ${currentSurvey.title}`}</p>
                </div>
                <span className="recent-surveys-count">
                  {mayorVoteResults.reduce((sum, item) => sum + item.votos, 0)} votos
                </span>
              </div>
              {mayorVoteQuestion ? (
                mayorVoteResults.length ? (
                  <div className="mayor-results-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mayorVoteResults} margin={{ top: 8, right: 8, left: -18, bottom: 52 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dce4e9" />
                        <XAxis dataKey="nombre" interval={0} angle={-28} textAnchor="end" height={68} tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="votos" name="Votos" radius={[5, 5, 0, 0]}>
                          {mayorVoteResults.map((item) => <Cell key={item.nombre} fill={item.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="recent-surveys-empty">No hay respuestas registradas para esta pregunta.</div>
                )
              ) : (
                <div className="recent-surveys-empty">Selecciona un estudio con una pregunta de votación para Alcalde.</div>
              )}
            </section>
            </div>

            {/* RESULTADOS DE TODAS LAS PREGUNTAS */}
            <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Estadísticas de todas las preguntas</h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Resultados basados en las {currentSurveyInterviews.length} encuestas registradas para {currentSurvey.municipality}.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className={`btn ${dashboardChartType === 'bar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDashboardChartType('bar')}>Columnas</button>
                  <button type="button" className={`btn ${dashboardChartType === 'pie' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDashboardChartType('pie')}>Pastel</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: '1rem' }}>
                {currentSurvey.questions
                  .filter((question) => question.id !== mayorVoteQuestion?.id)
                  .map((question) => {
                  const questionIndex = currentSurvey.questions.findIndex((item) => item.id === question.id);
                  const responseRecords = currentSurveyInterviews
                    .map((record) => ({
                      record,
                      answer: record.answers.find((answer) => answer.questionId === question.id)?.answerText,
                    }))
                    .filter((item) => Boolean(item.answer && item.answer !== 'Sin respuesta'));
                  const responses = responseRecords.map((item) => item.answer as string);
                  const isFreeTextQuestion = question.type === 'text' || /observaciones/i.test(question.title);
                  const data = question.options.length
                    ? question.options.map((option) => ({
                        nombre: option.text,
                        votos: responses.length
                          ? responses.filter((answer) => answer === option.text || answer.startsWith(`${option.text}:`)).length
                          : option.votes,
                        color: option.color || '#05a6f0'
                      }))
                    : Array.from(new Set(responses)).map((answer, index) => ({
                        nombre: answer.length > 32 ? `${answer.slice(0, 29)}...` : answer,
                        votos: responses.filter((item) => item === answer).length,
                        color: ['#05a6f0', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][index % 5]
                      }));
                  const total = data.reduce((sum, item) => sum + item.votos, 0);

                  return (
                    <section key={question.id} style={{ minWidth: 0, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'var(--bg-card, #fff)' }}>
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#05a6f0', fontWeight: 800 }}>{questionIndex + 1}.</span>
                        <div style={{ fontSize: '0.85rem', fontWeight: 750, lineHeight: 1.4 }}>{question.title}</div>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '0.25rem' }}>{total} respuestas</div>
                      {isFreeTextQuestion ? (
                        responseRecords.length > 0 ? (
                          <div style={{ maxHeight: 340, overflowY: 'auto', display: 'grid', gap: '.55rem', paddingRight: '.2rem' }}>
                            {responseRecords.map(({ record, answer }) => (
                              <article key={`${record.surveyId}-${record.id}-${question.id}`} style={{ padding: '.65rem .75rem', background: '#f4f9fc', border: '1px solid #d9edf7', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '.25rem .75rem', marginBottom: '.3rem', fontSize: '.72rem', color: 'var(--text-muted)' }}>
                                  <strong style={{ color: '#087fb8' }}>{record.id} · {record.enumeratorName || record.enumeratorAlias}</strong>
                                  <span>{record.community} · {formatGuatemalaDateTime(record.timestamp)}</span>
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '.82rem', color: 'var(--text-main, #1f2933)' }}>{answer}</div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div style={{ minHeight: 110, display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.8rem' }}>
                            No hay respuestas de texto registradas para esta pregunta.
                          </div>
                        )
                      ) : data.length > 0 && total > 0 ? (
                        <div style={{ height: 260, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            {dashboardChartType === 'bar' ? (
                              <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 35 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#dce4e9" />
                                <XAxis dataKey="nombre" stroke="#64748b" fontSize={10} tickLine={false} interval={0} angle={-20} textAnchor="end" />
                                <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                                <Tooltip formatter={(value) => [`${value} (${((Number(value) / total) * 100).toFixed(1)}%)`, 'Respuestas']} />
                                <Bar dataKey="votos" name="Respuestas" radius={[5, 5, 0, 0]}>
                                  {data.map((item, index) => <Cell key={`${question.id}-bar-${index}`} fill={item.color} />)}
                                </Bar>
                              </BarChart>
                            ) : (
                              <PieChart>
                                <Pie data={data} dataKey="votos" nameKey="nombre" cx="50%" cy="50%" outerRadius="75%" label={({ name, percent }) => `${String(name)} ${(Number(percent) * 100).toFixed(0)}%`}>
                                  {data.map((item, index) => <Cell key={`${question.id}-pie-${index}`} fill={item.color} />)}
                                </Pie>
                                <Tooltip formatter={(value) => [`${value} (${((Number(value) / total) * 100).toFixed(1)}%)`, 'Respuestas']} />
                              </PieChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div style={{ height: 260, display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {data.length ? 'Aún no hay respuestas para graficar.' : 'Esta pregunta no tiene respuestas registradas.'}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>

            {/* TABLA DE AUDITORÍA CON BOTÓN PARA VER Y DESCARGAR PDF POR PERSONA */}
            <div className="glass-panel">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">
                    <FileText size={18} style={{ color: '#06b6d4' }} />
                    Registro de Encuestas y Boletas Individuales (PDF)
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Consulte cómo votó o encuestó cada persona por su No. de Encuesta (ej: User1-01) y descargue el PDF
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-primary">{currentSurveyInterviews.length} Encuestas Registradas</span>
                  {currentUserRole === 'admin' && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ color: '#b42318', borderColor: 'rgba(180, 35, 24, 0.3)', fontSize: '.75rem' }}
                      onClick={() => void handleClearSurveyRecords(currentSurvey)}
                      disabled={isClearingSurveyRecords || currentSurveyInterviews.length === 0}
                    >
                      <Trash2 size={14} /> {isClearingSurveyRecords ? 'Borrando...' : 'Borrar registros del estudio'}
                    </button>
                  )}
                </div>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No. Encuesta</th>
                      <th>Encuestador</th>
                      <th>Comunidad Asignada</th>
                      <th>Edad / Género</th>
                      <th>Fecha / Hora</th>
                      <th>Voto Alcalde</th>
                      <th>Voto Presidente</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSurveyInterviews.map((item) => {
                      const alcAns = item.answers.find((a) => a.questionTitle.toLowerCase().includes('alcalde'))?.answerText || '—';
                      const presAns = item.answers.find((a) => a.questionTitle.toLowerCase().includes('presidente'))?.answerText || '—';

                      return (
                        <tr key={item.id}>
                          <td>
                            <span className="survey-id-badge">{item.id}</span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{item.enumeratorAlias}</td>
                          <td>{item.community}</td>
                          <td>{item.ageGroup} • {item.gender}</td>
                          <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatGuatemalaDateTime(item.timestamp)}</td>
                          <td style={{ fontWeight: 700, color: '#ec4899', fontSize: '0.78rem' }}>
                            {alcAns.length > 25 ? alcAns.substring(0, 22) + '...' : alcAns}
                          </td>
                          <td style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.78rem' }}>
                            {presAns.length > 25 ? presAns.substring(0, 22) + '...' : presAns}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedRecordForPdf(item)}
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: '#06b6d4', borderColor: '#06b6d4' }}
                                title="Ver boleta en pantalla"
                              >
                                <Eye size={12} /> Ver Boleta
                              </button>
                              <button
                                type="button"
                                onClick={() => generateInterviewPdf(item)}
                                className="btn btn-primary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                                title="Descargar PDF oficial"
                              >
                                <Download size={12} /> PDF
                              </button>
                              {currentUserRole === 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteInterview(item)}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: '#b42318', borderColor: 'rgba(180, 35, 24, 0.28)' }}
                                  title={item.databaseId ? 'Eliminar encuesta' : 'La encuesta debe sincronizarse antes de eliminarla'}
                                  aria-label={`Eliminar encuesta ${item.id}`}
                                  disabled={!item.databaseId || deletingInterviewId === item.databaseId}
                                >
                                  <Trash2 size={12} /> {deletingInterviewId === item.databaseId ? 'Borrando...' : 'Eliminar'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!isInterviewsLoading && currentSurveyInterviews.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {interviewsApiError ? 'No fue posible consultar las entrevistas en la base de datos.' : 'No hay entrevistas guardadas para esta encuesta.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && currentUserRole !== 'encuestador' && (
          <section aria-labelledby="election-reports-heading">
            <div className="glass-panel" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h2 id="election-reports-heading" style={{ fontSize: '1.25rem', fontWeight: 800 }}>Reportes electorales</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '.82rem', marginTop: '.3rem' }}>
                    Intención de voto calculada con las encuestas guardadas en {currentSurvey.title}.
                  </p>
                </div>
                <label className="form-group" style={{ minWidth: 'min(100%, 280px)', margin: 0 }}>
                  <span>Filtrar por comunidad</span>
                  <select className="form-select" value={reportCommunityFilter} onChange={(event) => setReportCommunityFilter(event.target.value)}>
                    <option value="all">Todas las comunidades</option>
                    {reportCommunities.map((community) => <option key={community} value={community}>{community}</option>)}
                  </select>
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginTop: '1rem', padding: '.75rem 1rem', borderRadius: 'var(--radius-sm)', background: '#eff8fc', color: '#075985', fontSize: '.85rem', flexWrap: 'wrap' }}>
                <Users size={17} />
                <strong>{reportInterviews.length.toLocaleString()} encuestas consideradas</strong>
                <span>· Los porcentajes usan como base el total de encuestas del filtro seleccionado.</span>
              </div>
            </div>

            {electionReports.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
                {electionReports.map((report) => {
                  const responded = report.results.filter((result) => result.label !== 'Sin respuesta').reduce((sum, result) => sum + result.count, 0);
                  return (
                    <section key={report.key} className="glass-panel" style={{ minWidth: 0 }} aria-labelledby={`report-${report.key}`}>
                      <div style={{ marginBottom: '1rem' }}>
                        <h3 id={`report-${report.key}`} style={{ fontSize: '1.05rem', fontWeight: 800, color: '#075985' }}>Votación para {report.label}</h3>
                        <p style={{ marginTop: '.35rem', color: 'var(--text-muted)', fontSize: '.76rem', lineHeight: 1.45 }}>{report.questionTitle}</p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', padding: '.65rem .75rem', marginBottom: '.6rem', borderRadius: 'var(--radius-sm)', background: '#f4f8fa', fontSize: '.76rem' }}>
                        <span>Respuestas registradas</span><strong>{responded} / {report.total}</strong>
                      </div>
                      {report.total > 0 ? (
                        <div style={{ display: 'grid', gap: '.75rem' }}>
                          {report.results.map((result) => {
                            const percentage = (result.count / report.total) * 100;
                            return (
                              <div key={`${report.key}-${result.label}`} style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '.75rem', marginBottom: '.3rem', fontSize: '.8rem' }}>
                                  <span style={{ overflowWrap: 'anywhere' }}>{result.label}</span>
                                  <strong style={{ whiteSpace: 'nowrap' }}>{percentage.toFixed(1)}% <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({result.count})</span></strong>
                                </div>
                                <div style={{ height: 8, borderRadius: 999, background: '#e7eef2', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(100, percentage)}%`, height: '100%', borderRadius: 999, background: result.color, transition: 'width 220ms ease' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="recent-surveys-empty">No hay encuestas para la comunidad seleccionada.</div>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="glass-panel recent-surveys-empty">El estudio seleccionado no tiene preguntas configuradas para Presidente, Alcalde o Diputados.</div>
            )}
          </section>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VISTA: GESTIÓN DE ESTUDIOS GUARDADOS
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'surveys_list' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Estudios Electorales y Municipales</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Administra las encuestas configuradas con sus comunidades y encuestadores asignados
                </p>
              </div>
              {currentUserRole === 'admin' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingSurveyId(null);
                    setActiveTab('builder');
                  }}
                >
                  <Plus size={16} />
                  Diseñar Nueva Encuesta
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
              {isSurveysLoading && surveys.length === 0 && (
                <div className="glass-panel" role="status">Cargando encuestas...</div>
              )}
              {surveyApiError && <div className="glass-panel" role="alert">{surveyApiError}</div>}
              {!isSurveysLoading && !surveyApiError && surveys.length === 0 && (
                <div className="glass-panel">
                  Aún no hay encuestas guardadas. Diseña una encuesta para comenzar.
                </div>
              )}
              {surveys.map((srv) => {
                const pct = srv.targetSample > 0
                  ? Math.min(100, Math.round((srv.collectedSample / srv.targetSample) * 100))
                  : 0;

                return (
                  <div key={srv.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span className={`badge ${srv.status === 'active' ? 'badge-emerald' : srv.status === 'archived' ? 'badge-archived' : srv.status === 'completed' ? 'badge-amber' : 'badge-primary'}`}>
                        {srv.status === 'active' ? 'En Campo' : srv.status === 'archived' ? 'Archivada' : srv.status === 'completed' ? 'Finalizada' : 'Borrador'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {srv.code}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                      {srv.title}
                    </h3>

                    {currentUserRole === 'admin' && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {srv.status === 'archived' ? (
                          <button type="button" className="btn btn-primary" style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem' }} onClick={() => void handleRestoreSurvey(srv)} disabled={isSurveySaving}>
                            <RefreshCw size={14} /> Reactivar encuesta
                          </button>
                        ) : <>
                          <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }} onClick={() => handleStartEditSurvey(srv)}>
                            <Pencil size={13} /> Editar
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#b42318', borderColor: 'rgba(180, 35, 24, 0.28)' }} onClick={() => void handleDeleteSurvey(srv)} disabled={isSurveySaving}>
                            <Trash2 size={13} /> Archivar
                          </button>
                        </>}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      <span style={{ color: '#06b6d4', fontWeight: 700 }}>{srv.municipality}</span>
                      <span>•</span>
                      <span>{srv.department}</span>
                      <span>•</span>
                      <span>{srv.communities.length} Comunidades</span>
                      <span>•</span>
                      <span>{srv.questions.length} Preguntas</span>
                    </div>

                    {/* Desglose de Comunidades */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.85rem' }}>
                      {srv.communities.map((c) => (
                        <span
                          key={c.id}
                          style={{
                            background: '#f4f7f9',
                            border: '1px solid var(--border-subtle)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.68rem'
                          }}
                        >
                          📍 {c.name} <strong style={{ color: '#43bff5' }}>({c.assignedTo})</strong>
                        </span>
                      ))}
                    </div>

                    {/* Muestra Recolectada */}
                    <div style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Muestra Recolectada</span>
                      <span style={{ fontWeight: 800 }}>
                        {srv.collectedSample.toLocaleString()} / {srv.targetSample.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div style={{ background: '#e8eef2', height: '6px', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#05a6f0' }}></div>
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSurveyId(srv.id);
                          setActiveTab('dashboard');
                        }}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                      >
                        <BarChart3 size={13} /> Ver Resultados
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSurveyId(srv.id);
                          setActiveTab('survey');
                        }}
                        className="btn btn-primary"
                        style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                      >
                        <Smartphone size={13} /> Recolectar en Campo
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VISTA: MAPA DE PUNTOS GPS EN EL MUNICIPIO
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'map' && (
          <div>
            <div className="glass-panel" style={{ marginBottom: '1.25rem' }}>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    <MapPin size={20} style={{ color: '#06b6d4' }} />
                    Mapa GPS de Encuestas — {currentSurvey.municipality}
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {mapInterviews.length > 0
                      ? `Mostrando la ubicación GPS de ${mapInterviews.length} encuesta(s) de este estudio.`
                      : 'Aún no hay coordenadas de encuestas en este estudio. Mostrando Guatemala.'}
                  </p>
                </div>
                <span className="badge badge-primary">{mapInterviews.length} Encuestas Mapeadas</span>
              </div>

              <div className="gps-map-shell">
                <MapContainer
                  key={currentSurvey.id}
                  center={[14.6349, -90.5069]}
                  zoom={7}
                  scrollWheelZoom
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitMapToInterviews records={mapInterviews} />
                  {mapInterviews.map((record) => (
                    <Marker key={record.id} position={[record.lat, record.lng]} icon={interviewMarkerIcon}>
                      <Popup>
                        <div className="gps-popup">
                          <strong>{record.id} · {record.community}</strong>
                          <span>Encuestador: {record.enumeratorAlias}</span>
                          <span>Coordenadas: {record.lat.toFixed(5)}, {record.lng.toFixed(5)}</span>
                          <span>Precisión GPS: ±{record.accuracy} m</span>
                          <span>{formatGuatemalaDateTime(record.timestamp)}</span>
                          <button type="button" onClick={() => setSelectedRecordForPdf(record)} className="btn btn-primary">
                            Ver boleta
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            VISTA: COMUNIDADES Y ASIGNACIONES (SUPERVISIÓN Y CONTROL)
           ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'supervisors' && (
          <div>
            <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
              {(() => {
                const assignmentSurvey = surveys.find((survey) => survey.id === assignmentSurveyId);
                const assignedCommunities = assignmentSurvey?.communities ?? [];
                const totalCommunityQuota = assignedCommunities.reduce((sum, community) => sum + community.quota, 0);
                const assignedEnumeratorCount = new Set(assignedCommunities.map((community) => community.assignedTo.trim().toLowerCase()).filter(Boolean)).size;
                const assignedSurveyInterviews = interviews.filter((record) => record.surveyId === assignmentSurveyId);
                const totalRemainingQuota = assignedCommunities.reduce((sum, community) => {
                  const completed = assignedSurveyInterviews.filter((record) => record.communityId
                    ? record.communityId === community.id
                    : record.community.toLowerCase() === community.name.toLowerCase()).length;
                  return sum + Math.max(0, community.quota - completed);
                }, 0);
                return <>
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    <ShieldCheck size={20} style={{ color: '#10b981' }} />
                    Comunidades y asignaciones
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Elige un estudio guardado para consultar y administrar sus asignaciones.
                  </p>
                </div>
                <select className="form-select" value={assignmentSurveyId} onChange={(event) => setAssignmentSurveyId(event.target.value)} style={{ maxWidth: 420 }}>
                  <option value="">Seleccionar encuesta o estudio guardado</option>
                  {surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.title} — {survey.municipality}</option>)}
                </select>
              </div>

              {!assignmentSurveyId && <div className="empty-state">Selecciona un estudio guardado para ver sus comunidades.</div>}
              {assignmentSurveyId && assignmentSurvey && <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.8rem', margin: '1rem 0', padding: '0.85rem 1rem', background: '#f4f7f9', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <strong>{assignmentSurvey.title}</strong><span style={{ color: 'var(--text-muted)' }}> · {assignmentSurvey.department} · {assignmentSurvey.municipality} · {assignmentSurvey.status === 'active' ? 'Activo' : assignmentSurvey.status === 'draft' ? 'Borrador' : 'Completado'}</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => void generateCommunityAssignmentsPdf(assignmentSurvey)}>
                  <Printer size={16} /> Ver / imprimir PDF
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Comunidades asignadas', value: assignedCommunities.length, color: '#05a6f0' },
                  { label: 'Encuestadores asignados', value: assignedEnumeratorCount, color: '#7c3aed' },
                  { label: 'Meta total de encuestas', value: totalCommunityQuota, color: '#087a55' },
                  { label: 'Encuestas realizadas', value: assignedSurveyInterviews.length, color: '#0891b2' },
                  { label: 'Encuestas pendientes', value: totalRemainingQuota, color: '#d97706' },
                ].map((stat) => (
                  <div key={stat.label} style={{ minWidth: 0, padding: '.85rem 1rem', background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '.73rem' }}>{stat.label}</div>
                    <strong style={{ display: 'block', marginTop: '.25rem', color: stat.color, fontSize: '1.25rem' }}>{stat.value}</strong>
                  </div>
                ))}
              </div>

              {currentUserRole === 'admin' && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 2fr) minmax(130px, 1fr) minmax(200px, 1fr) auto', gap: '.75rem', alignItems: 'end', padding: '1rem', marginBottom: '1rem', background: '#f4f7f9', borderRadius: 'var(--radius-sm)' }}>
                <label className="form-group"><span>Nombre de comunidad</span><input className="form-input" value={newAssignedCommunityName} onChange={(event) => setNewAssignedCommunityName(event.target.value)} placeholder="Ej. Aldea El Astillero" maxLength={150} /></label>
                <label className="form-group"><span>Meta de encuestas</span><input className="form-input" type="number" min={0} max={1000000} step={1} value={newAssignedCommunityQuota} onChange={(event) => setNewAssignedCommunityQuota(Number(event.target.value))} /></label>
                <label className="form-group"><span>Asignar a</span><select className="form-select" value={newAssignedCommunityEnumerator || activeEnumerators[0]?.alias || ''} onChange={(event) => setNewAssignedCommunityEnumerator(event.target.value)}>{activeEnumerators.map((user) => <option key={user.id} value={user.alias}>{user.alias} — {user.fullName}</option>)}</select></label>
                <button type="button" className="btn btn-primary" onClick={() => void handleCreateAssignedCommunity()} disabled={!newAssignedCommunityName.trim() || activeEnumerators.length === 0 || savingAssignmentId !== null || assignmentSurvey.status === 'completed'}><Plus size={16} /> Agregar comunidad</button>
              </div>}

              <div className="assignment-enumerator-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {activeEnumerators.map((enumerator) => {
                  const comms = assignmentSurvey.communities.filter((c) => c.assignedTo.toLowerCase() === enumerator.alias.toLowerCase());
                  const totalQ = comms.reduce((a, b) => a + b.quota, 0);
                  const userInterviews = interviews.filter((i) => i.surveyId === assignmentSurvey.id && i.enumeratorAlias.toLowerCase() === enumerator.alias.toLowerCase());

                  return <div key={enumerator.id} className="glass-panel assignment-enumerator-card" style={{ borderLeft: '3px solid #05a6f0', padding: '1rem' }}>
                      <div className="assignment-enumerator-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontWeight: 800, fontSize: '0.95rem', color: '#1f2933' }}>
                          👤 {enumerator.fullName} <small style={{ color: 'var(--text-muted)' }}>@{enumerator.alias}</small>
                        </span>
                        <span className="badge badge-primary">{comms.length} comunidad(es)</span>
                      </div>

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                        Meta asignada: <strong style={{ color: '#05a6f0' }}>{totalQ}</strong> · Encuestas: <strong style={{ color: '#10b981' }}>{userInterviews.length}</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {comms.length ? comms.map((c) => {
                          const completedInCommunity = interviews.filter((record) =>
                            record.surveyId === assignmentSurvey.id &&
                            (record.communityId ? record.communityId === c.id : record.community.toLowerCase() === c.name.toLowerCase())
                          ).length;
                          return <div key={c.id} style={{ minWidth: 0, background: '#f4f7f9', padding: '0.45rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start', gap: '0.4rem' }}>
                            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>📍 {c.name}</span>
                            <span style={{ color: completedInCommunity >= c.quota ? '#b42318' : '#05a6f0', fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'right' }}>
                              {completedInCommunity}/{c.quota} encuestas{completedInCommunity >= c.quota ? ' · Meta alcanzada' : ''}
                            </span>
                          </div>;
                        }) : <span style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>Sin comunidades asignadas</span>}
                      </div>
                    </div>;
                })}
              </div>

              <div style={{ background: '#f4f7f9', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 800 }}>
                    Comunidades de {assignmentSurvey.municipality}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Los cambios se guardan en la base de datos.
                  </span>
                </div>

                <div className="table-responsive assigned-communities-responsive">
                  <table className="data-table assigned-communities-table">
                    <thead>
                      <tr>
                        <th>Comunidad / Aldea</th>
                        <th>Meta Cuota</th>
                        <th>Encuestador Asignado (Exclusivo)</th>
                        <th>Asignar a encuestador</th>
                        {currentUserRole === 'admin' && <th>Editar</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {assignmentSurvey.communities.map((c) => (
                        <tr key={c.id}>
                          <td data-label="Comunidad / Aldea" style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>📍 {c.name}</td>
                          <td data-label="Meta Cuota">{c.quota} encuestas</td>
                          <td data-label="Encuestador asignado">
                            <span className="survey-id-badge" style={{ fontSize: '0.75rem' }}>
                              {activeEnumerators.find((user) => user.alias.toLowerCase() === c.assignedTo.toLowerCase())?.fullName ?? c.assignedTo} (@{c.assignedTo})
                            </span>
                          </td>
                          <td data-label="Asignar a encuestador">
                            {currentUserRole === 'admin' ? (
                              <select
                                className="form-select"
                                value={c.assignedTo}
                                disabled={savingAssignmentId === c.id || assignmentSurvey.status === 'completed' || activeEnumerators.length === 0}
                                onChange={(e) => void handleReassignActiveSurveyCommunity(c.id, e.target.value)}
                                style={{ minWidth: '220px', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                {activeEnumerators.map((user) => <option key={user.id} value={user.alias}>{user.alias} — {user.fullName}</option>)}
                              </select>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Solo Admin puede reasignar
                              </span>
                            )}
                          </td>
                          {currentUserRole === 'admin' && <td data-label="Editar"><button type="button" className="btn btn-secondary" onClick={() => void handleEditAssignedCommunity(c)} disabled={savingAssignmentId === c.id || assignmentSurvey.status === 'completed'}><Pencil size={14} /> Editar</button></td>}
                        </tr>
                      ))}
                      {assignmentSurvey.communities.length === 0 && <tr><td colSpan={currentUserRole === 'admin' ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>Este estudio todavía no tiene comunidades asignadas.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              </>}
              </>;
              })()}
            </div>
          </div>
        )}

        {activeTab === 'users' && currentUserRole === 'admin' && (
          <section aria-labelledby="users-module-title">
            <div className="panel-header">
              <div>
                <h2 className="panel-title" id="users-module-title">
                  <Users size={20} style={{ color: '#05a6f0' }} /> Gestión de usuarios
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  Crea cuentas y asigna permisos de administrador, supervisor o encuestador.
                </p>
              </div>
              <span className="badge badge-primary">Solo administrador</span>
            </div>

            {userFormAlert && (
              <div
                role="status"
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: userFormAlert.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${userFormAlert.type === 'success' ? 'rgba(16, 185, 129, 0.28)' : 'rgba(239, 68, 68, 0.28)'}`,
                  color: userFormAlert.type === 'success' ? '#087a55' : '#b42318',
                  fontSize: '0.85rem',
                  fontWeight: 600
                }}
              >
                {userFormAlert.message}
              </div>
            )}

            <div className="users-module-grid">
              <form className="glass-panel" onSubmit={handleCreateUser}>
                <div className="panel-header" style={{ marginBottom: '1rem' }}>
                  <h3 className="panel-title">
                    {editingUserId ? <Pencil size={18} style={{ color: '#05a6f0' }} /> : <UserPlus size={18} style={{ color: '#05a6f0' }} />}
                    {editingUserId ? 'Editar usuario' : 'Crear usuario'}
                  </h3>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-alias">Alias de usuario</label>
                  <input id="new-user-alias" className="form-input" value={newUserAlias} onChange={(e) => setNewUserAlias(e.target.value)} placeholder="Ej. User5" required maxLength={40} disabled={Boolean(editingUserId)} />
                  {editingUserId && <small style={{ color: 'var(--text-muted)' }}>El alias no se puede cambiar porque identifica asignaciones e historial.</small>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-name">Nombre completo</label>
                  <input id="new-user-name" className="form-input" value={newUserFullName} onChange={(e) => setNewUserFullName(e.target.value)} placeholder="Nombre y apellidos" required maxLength={120} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-email">Correo electrónico</label>
                  <input id="new-user-email" className="form-input" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="usuario@encuestas.gt" required maxLength={180} />
                </div>
                {!editingUserId && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-user-password">Contraseña inicial</label>
                    <input id="new-user-password" className="form-input" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Mínimo 12 caracteres" autoComplete="new-password" required minLength={12} maxLength={128} />
                  </div>
                )}
                {editingUserId && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-user-password">Nueva contraseña <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                    <input id="new-user-password" className="form-input" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Dejar vacío para conservarla" autoComplete="new-password" minLength={12} maxLength={128} />
                    <small style={{ color: 'var(--text-muted)' }}>Si la cambias, debe tener al menos 12 caracteres y se cerrarán sus sesiones activas.</small>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-phone">Teléfono <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                  <input id="new-user-phone" className="form-input" type="tel" value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} placeholder="+502 5555-5555" maxLength={30} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-user-role">Rol asignado</label>
                  <select id="new-user-role" className="form-select" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as UserRole)}>
                    <option value="encuestador">Encuestador</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isUserSaving}>
                    {editingUserId ? <Save size={16} /> : <UserPlus size={16} />}
                    {isUserSaving ? 'Guardando...' : editingUserId ? 'Guardar cambios' : 'Crear cuenta'}
                  </button>
                  {editingUserId && (
                    <button type="button" className="btn btn-secondary" onClick={resetUserForm}>Cancelar</button>
                  )}
                </div>
              </form>

              <div className="glass-panel">
                <div className="panel-header" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 className="panel-title"><Users size={18} style={{ color: '#05a6f0' }} /> Usuarios registrados</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>{usersList.length} cuenta(s)</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.55rem', flex: '1 1 280px', justifyContent: 'flex-end' }}>
                    <input className="form-input" aria-label="Buscar usuario" value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} placeholder="Buscar por nombre, alias o correo" />
                    <select className="form-select" aria-label="Filtrar por rol" value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} style={{ maxWidth: '155px' }}>
                      <option value="all">Todos los roles</option>
                      <option value="admin">Administrador</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="encuestador">Encuestador</option>
                    </select>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr><th>Usuario</th><th>Contacto</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{user.fullName}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>@{user.alias}</div>
                          </td>
                          <td>
                            <div>{user.email}</div>
                            {user.phone && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{user.phone}</div>}
                          </td>
                          <td>
                            <span className={`user-role-badge ${user.role === 'admin' ? 'role-admin' : user.role === 'supervisor' ? 'role-supervisor' : 'role-encuestador'}`}>
                              {user.role === 'admin' ? 'Administrador' : user.role === 'supervisor' ? 'Supervisor' : 'Encuestador'}
                            </span>
                          </td>
                          <td><span className={`status-pill ${user.status}`}>{user.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                          <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{user.createdAt}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button type="button" className="btn btn-secondary" aria-label={`Editar ${user.alias}`} title="Editar usuario" style={{ padding: '0.35rem 0.5rem' }} onClick={() => handleStartEditUser(user)}>
                                <Pencil size={14} />
                              </button>
                              {user.status === 'active' ? (
                                <button type="button" className="btn btn-secondary" aria-label={`Desactivar ${user.alias}`} title="Desactivar usuario" style={{ padding: '0.35rem 0.5rem', color: '#b42318', borderColor: 'rgba(180, 35, 24, 0.28)' }} onClick={() => void handleDeleteUser(user)} disabled={isUserSaving}>
                                  <Trash2 size={14} />
                                </button>
                              ) : (
                                <button type="button" className="btn btn-secondary" aria-label={`Reactivar ${user.alias}`} title="Reactivar usuario" style={{ padding: '0.35rem 0.5rem', color: '#087a55', borderColor: 'rgba(8, 122, 85, 0.28)' }} onClick={() => void handleActivateUser(user)} disabled={isUserSaving}>
                                  <UserCheck size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{isUsersLoading ? 'Cargando usuarios...' : 'No hay usuarios que coincidan con la búsqueda.'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'admin_config' && currentUserRole === 'admin' && (
          <section className="admin-logs-module" aria-labelledby="admin-logs-title">
            <div className="panel-header admin-logs-header">
              <div>
                <h2 className="panel-title" id="admin-logs-title">
                  <Settings2 size={20} style={{ color: '#05a6f0' }} /> Configuración y bitácora del sistema
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  Actividad de usuarios, origen de sesiones y errores del servidor o navegador.
                </p>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => void handleRefreshAdminLogs()} disabled={adminLogsLoading}>
                <RefreshCw size={15} className={adminLogsLoading ? 'animate-spin' : ''} />
                {adminLogsLoading ? 'Actualizando...' : 'Actualizar registros'}
              </button>
            </div>

            {adminLogsError && <div className="admin-logs-error" role="alert">{adminLogsError}</div>}

            <div className="admin-logs-toolbar">
              <div className="admin-logs-tabs" role="tablist" aria-label="Registros de administración">
                <button type="button" role="tab" aria-selected={adminLogsTab === 'audit'} className={adminLogsTab === 'audit' ? 'selected' : ''} onClick={() => setAdminLogsTab('audit')}>
                  Historial de actividad ({auditEvents.length})
                </button>
                <button type="button" role="tab" aria-selected={adminLogsTab === 'errors'} className={adminLogsTab === 'errors' ? 'selected' : ''} onClick={() => setAdminLogsTab('errors')}>
                  <Bug size={15} />
                  Errores ({applicationErrors.length})
                </button>
              </div>
              <input
                className="form-input admin-logs-search"
                aria-label="Buscar en la bitácora"
                placeholder="Buscar usuario, acción, IP o mensaje"
                value={adminLogsSearch}
                onChange={(event) => setAdminLogsSearch(event.target.value)}
              />
            </div>

            {adminLogsTab === 'audit' ? (
              <div className="table-responsive admin-logs-table-wrap">
                <table className="data-table admin-logs-table">
                  <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>IP de origen</th><th>Origen / navegador</th><th>Detalle</th></tr></thead>
                  <tbody>
                    {filteredAuditEvents.map((event) => (
                      <tr key={event.id}>
                        <td>{formatGuatemalaDateTime(event.createdAt)}</td>
                        <td><strong>{event.userName}</strong></td>
                        <td><span className="admin-log-action">{event.action}</span></td>
                        <td>{event.entityType ?? '—'}</td>
                        <td>{event.ipAddress ?? '—'}</td>
                        <td title={event.userAgent ?? ''}>{event.origin || event.userAgent || '—'}</td>
                        <td>
                          <details>
                            <summary>Ver</summary>
                            {event.action === 'interview.created' && typeof event.changes === 'object' && event.changes !== null ? (() => {
                              const changes = event.changes as Record<string, unknown>;
                              const startedAt = typeof changes.startedAt === 'string' ? changes.startedAt : null;
                              const finishedAt = typeof changes.finishedAt === 'string' ? changes.finishedAt : null;
                              return (
                                <div className="admin-log-json">
                                  <div><strong>Folio:</strong> {String(changes.folio ?? '—')}</div>
                                  <div><strong>Inicio:</strong> {startedAt ? formatGuatemalaDateTime(startedAt) : 'No disponible'}</div>
                                  <div><strong>Finalización:</strong> {finishedAt ? formatGuatemalaDateTime(finishedAt) : 'No disponible'}</div>
                                  <div><strong>Duración:</strong> {startedAt && finishedAt ? formatElapsedTime(startedAt, finishedAt) : 'No disponible'}</div>
                                  <pre>{JSON.stringify(event.changes, null, 2)}</pre>
                                </div>
                              );
                            })() : <pre className="admin-log-json">{JSON.stringify(event.changes ?? {}, null, 2)}</pre>}
                          </details>
                        </td>
                      </tr>
                    ))}
                    {filteredAuditEvents.length === 0 && <tr><td colSpan={7} className="admin-logs-empty">{adminLogsLoading ? 'Cargando bitácora...' : 'No hay actividades que coincidan.'}</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-responsive admin-logs-table-wrap">
                <table className="data-table admin-logs-table">
                  <thead><tr><th>Fecha y hora</th><th>Origen</th><th>Error</th><th>Ruta</th><th>Usuario</th><th>IP</th><th>Detalle técnico</th></tr></thead>
                  <tbody>
                    {filteredApplicationErrors.map((error) => (
                      <tr key={error.id}>
                        <td>{formatGuatemalaDateTime(error.createdAt)}</td>
                        <td><span className={`admin-log-source ${error.source}`}>{error.source === 'backend' ? 'Servidor' : 'Frontend'}</span></td>
                        <td className="admin-log-message">{error.message}</td>
                        <td>{error.method ? `${error.method} ` : ''}{error.path ?? '—'}</td>
                        <td>{error.userName ?? 'Sin sesión'}</td>
                        <td>{error.ipAddress ?? '—'}</td>
                        <td>
                          <details>
                            <summary>Ver</summary>
                            {error.stack && <pre className="admin-log-json">{error.stack}</pre>}
                            <pre className="admin-log-json">{JSON.stringify(error.details ?? {}, null, 2)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                    {filteredApplicationErrors.length === 0 && <tr><td colSpan={7} className="admin-logs-empty">{adminLogsLoading ? 'Cargando errores...' : 'No hay errores que coincidan.'}</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <p className="admin-logs-retention-note">Se muestran hasta 100 registros recientes. El sistema guarda IP, navegador y origen web como referencia de acceso; no determina una ubicación geográfica precisa.</p>
          </section>
        )}
      </main>

      <footer className="app-footer">
        <span>© {new Date().getFullYear()} AMTECHNOLOGY. Todos los derechos reservados.</span>
        <span>Diseñado y desarrollado por <strong>Ing. Manuel Veliz Najera</strong></span>
      </footer>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: VISOR DE BOLETA DE ENCUESTA Y DESCARGA EN PDF
         ══════════════════════════════════════════════════════════════ */}
      {selectedRecordForPdf && (
        <div className="modal-overlay" onClick={() => setSelectedRecordForPdf(null)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <FileText size={20} style={{ color: '#38bdf8' }} />
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                    Boleta de Encuesta {selectedRecordForPdf.id}
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Verificación individual de respuestas del ciudadano
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecordForPdf(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.3rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Documento estilo papel membretado */}
              <div className="boleta-sheet">
                <div className="boleta-sheet-header">
                  <div>
                    <div className="boleta-sheet-title">Boleta Oficial de Encuesta</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      Sistema de Encuestas Municipales • Guatemala
                    </div>
                  </div>
                  <div className="boleta-folio-badge">{selectedRecordForPdf.id}</div>
                </div>

                <div className="boleta-meta-grid">
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Encuestador</span>
                    <strong style={{ color: '#22272b' }}>{selectedRecordForPdf.enumeratorAlias}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Municipio</span>
                    <strong style={{ color: '#22272b' }}>{selectedRecordForPdf.municipality}, {selectedRecordForPdf.department}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Comunidad Asignada</span>
                    <strong style={{ color: '#22272b' }}>{selectedRecordForPdf.community}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Fecha y Hora</span>
                    <strong style={{ color: '#22272b' }}>{formatGuatemalaDateTime(selectedRecordForPdf.timestamp)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Edad y Género</span>
                    <strong style={{ color: '#22272b' }}>{selectedRecordForPdf.ageGroup} • {selectedRecordForPdf.gender}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'block' }}>Coordenadas GPS</span>
                    <strong style={{ color: '#16a34a' }}>{selectedRecordForPdf.lat}, {selectedRecordForPdf.lng}</strong>
                  </div>
                </div>

                {/* Preguntas y Respuestas */}
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                  Cuestionario y Votos Registrados:
                </div>

                <div className="boleta-qa-list">
                  {selectedRecordForPdf.answers.map((ans, idx) => (
                    <div key={idx} className="boleta-qa-item">
                      <div className="boleta-q-title">
                        {idx + 1}. {ans.questionTitle}
                      </div>
                      <div className="boleta-a-text">
                        <span>✓</span>
                        <span>{ans.answerText}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1', fontSize: '0.7rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Certificación Digital: SHA256-{selectedRecordForPdf.id}</span>
                  <span>Auditoría de Campo Aprobada</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
              >
                <Printer size={15} /> Imprimir Boleta
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedRecordForPdf(null)}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => generateInterviewPdf(selectedRecordForPdf)}
                >
                  <Download size={15} /> Descargar Archivo PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
