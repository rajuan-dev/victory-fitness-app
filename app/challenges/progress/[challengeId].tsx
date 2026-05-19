import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { Colors } from '../../../constants/Colors';
import { apiRequest } from '../../../lib/api';
import { ErrorPopupModal } from '../../../components/ErrorPopupModal';
import { formatAppError } from '../../../lib/error';

type ChallengePlanExercise = {
  id: string;
  name: string;
  details: string;
  notes: string;
  workout_id: string;
  workout_title: string;
  workout_vimeo_id: string;
  workout_thumbnail: string;
};

type ChallengePlanSection = {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  exercises: ChallengePlanExercise[];
};

type ChallengePlanDay = {
  day_number: number;
  title: string;
  focus: string;
  notes: string;
  sections: ChallengePlanSection[];
};

type ChallengePlanDayProgress = {
  day_number: number;
  completed: boolean;
  completed_section_ids: string[];
  completed_exercise_ids: string[];
};

type ChallengePlanProgressResponse = {
  challenge_id: string;
  viewer_membership_status: string;
  viewer_progress_days_completed: number;
  viewer_points_earned: number;
  viewer_plan_progress: ChallengePlanDayProgress[];
};

type ChallengeProgressThread = {
  challenge_id: string;
  title: string;
  description: string;
  plan_text: string;
  plan_days: ChallengePlanDay[];
  category: string;
  duration_days: number;
  points: number;
  difficulty: string;
  status: string;
  thumbnail: string;
  participant_count: number;
  viewer_membership_status: string;
  viewer_progress_days_completed: number;
  viewer_points_earned: number;
  viewer_plan_progress: ChallengePlanDayProgress[];
};

type UnitPointMap = Record<string, number>;
type CompletedReportEntry = {
  title: string;
  detail: string;
};

const GOOGLE_PLAY_URL = 'https://play.google.com/store';
const APP_STORE_URL = 'https://apps.apple.com/app';

function buildWorkoutPlayerHtml(videoUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #050816;
        overflow: hidden;
      }
      .frame {
        position: fixed;
        inset: 0;
        border: 0;
        width: 100%;
        height: 100%;
        background: #050816;
      }
    </style>
  </head>
  <body>
    <iframe
      class="frame"
      src="${videoUrl}"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
    ></iframe>
    <script>
      window.open = function () { return null; };
      document.addEventListener('click', function (event) {
        var target = event.target;
        if (target && target.closest && target.closest('a')) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
    </script>
  </body>
</html>`;
}

function isAllowedWorkoutPlayerRequest(url: string): boolean {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    return false;
  }
  if (normalizedUrl === 'about:blank' || normalizedUrl.startsWith('data:') || normalizedUrl.startsWith('blob:')) {
    return true;
  }
  return normalizedUrl.startsWith('https://player.vimeo.com/video/');
}

function buildUnitPointMap(planDays: ChallengePlanDay[], totalPoints: number): UnitPointMap {
  const unitKeys: string[] = [];

  for (const day of planDays) {
    for (const section of day.sections) {
      if (section.exercises.length > 0) {
        for (const exercise of section.exercises) {
          unitKeys.push(exercise.id);
        }
      } else {
        unitKeys.push(section.id);
      }
    }
  }

  if (unitKeys.length === 0 || totalPoints <= 0) {
    return {};
  }

  const basePoints = Math.floor(totalPoints / unitKeys.length);
  const remainder = totalPoints % unitKeys.length;
  const map: UnitPointMap = {};
  for (const [index, key] of unitKeys.entries()) {
    map[key] = basePoints + (index < remainder ? 1 : 0);
  }
  return map;
}

function getSectionPoints(section: ChallengePlanSection, unitPointMap: UnitPointMap) {
  if (section.exercises.length > 0) {
    return section.exercises.reduce((total, exercise) => total + (unitPointMap[exercise.id] || 0), 0);
  }
  return unitPointMap[section.id] || 0;
}

function getDayPoints(day: ChallengePlanDay, unitPointMap: UnitPointMap) {
  return day.sections.reduce((total, section) => total + getSectionPoints(section, unitPointMap), 0);
}

function getSectionCompletedCount(section: ChallengePlanSection, completedExerciseIds: string[]) {
  const safeCompletedExerciseIds = Array.isArray(completedExerciseIds) ? completedExerciseIds : [];
  if (section.exercises.length === 0) {
    return 0;
  }
  return section.exercises.filter((exercise) => safeCompletedExerciseIds.includes(exercise.id)).length;
}

function isExerciseCompleted(
  section: ChallengePlanSection,
  exerciseId: string,
  completedExerciseIds: string[],
  completedSectionIds: string[],
) {
  const safeCompletedExerciseIds = Array.isArray(completedExerciseIds) ? completedExerciseIds : [];
  const safeCompletedSectionIds = Array.isArray(completedSectionIds) ? completedSectionIds : [];
  if (safeCompletedSectionIds.includes(section.id)) {
    return true;
  }
  return safeCompletedExerciseIds.includes(exerciseId);
}

function getDayProgressFraction(day: ChallengePlanDay, progress?: ChallengePlanDayProgress) {
  if (!progress) {
    return 0;
  }

  const completedExerciseIds = Array.isArray(progress.completed_exercise_ids) ? progress.completed_exercise_ids : [];
  const completedSectionIds = Array.isArray(progress.completed_section_ids) ? progress.completed_section_ids : [];
  const exerciseCount = day.sections.reduce((total, section) => total + section.exercises.length, 0);
  if (exerciseCount > 0) {
    const completedCount = day.sections.reduce((total, section) => {
      if (completedSectionIds.includes(section.id)) {
        return total + section.exercises.length;
      }
      return total + getSectionCompletedCount(section, completedExerciseIds);
    }, 0);
    return Math.min(completedCount / exerciseCount, 1);
  }

  if (day.sections.length > 0) {
    const completedCount = day.sections.filter((section) => completedSectionIds.includes(section.id)).length;
    return Math.min(completedCount / day.sections.length, 1);
  }

  return progress.completed ? 1 : 0;
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildCompletedReportEntries(thread: ChallengeProgressThread, dayProgressMap: Map<number, ChallengePlanDayProgress>) {
  const entries: CompletedReportEntry[] = [];

  for (const day of thread.plan_days) {
    const dayProgress = dayProgressMap.get(day.day_number);
    const completedExerciseIds = new Set(Array.isArray(dayProgress?.completed_exercise_ids) ? dayProgress.completed_exercise_ids : []);
    const completedSectionIds = new Set(Array.isArray(dayProgress?.completed_section_ids) ? dayProgress.completed_section_ids : []);

    if (dayProgress?.completed) {
      entries.push({
        title: `Day ${day.day_number} completed`,
        detail: `${day.title} · ${day.focus}`,
      });
      continue;
    }

    for (const section of day.sections) {
      if (completedSectionIds.has(section.id)) {
        entries.push({
          title: `Section completed`,
          detail: `Day ${day.day_number} · ${section.title}`,
        });
        continue;
      }

      for (const exercise of section.exercises) {
        if (completedExerciseIds.has(exercise.id)) {
          entries.push({
            title: exercise.name,
            detail: `Day ${day.day_number} · ${section.title}`,
          });
        }
      }
    }
  }

  return entries.slice(0, 10);
}

function buildChallengeProgressShareMessage(thread: ChallengeProgressThread, entries: CompletedReportEntry[]) {
  const completedLines = entries.length > 0
    ? entries.map((entry) => `• ${entry.title} — ${entry.detail}`).join('\n')
    : '• No completed items yet';

  return [
    `Victory Fitness`,
    `${thread.title} progress report`,
    `Completed ${thread.viewer_progress_days_completed}/${thread.duration_days} days · ${thread.viewer_points_earned}/${thread.points} pts`,
    '',
    completedLines,
    '',
    `Get the app on Google Play: ${GOOGLE_PLAY_URL}`,
    `Get the app on the App Store: ${APP_STORE_URL}`,
  ].join('\n').slice(0, 5000);
}

function buildChallengeProgressSvg(thread: ChallengeProgressThread, entries: CompletedReportEntry[]) {
  const width = 1080;
  const headerHeight = 290;
  const rowHeight = 88;
  const footerHeight = 210;
  const rows = Math.max(entries.length, 1);
  const height = headerHeight + rows * rowHeight + footerHeight;
  const generatedAt = new Date().toLocaleDateString();
  const content = (entries.length > 0 ? entries : [{ title: 'No completed items yet', detail: 'Finish exercises to build your share card.' }])
    .map((entry, index) => {
      const y = headerHeight + index * rowHeight;
      return `
        <g transform="translate(72 ${y})">
          <circle cx="16" cy="24" r="16" fill="#00F0D0" fill-opacity="0.18" />
          <text x="16" y="30" text-anchor="middle" font-size="18" font-family="Arial, sans-serif" fill="#00F0D0">✓</text>
          <text x="48" y="18" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">${xmlEscape(entry.title)}</text>
          <text x="48" y="50" font-size="22" font-family="Arial, sans-serif" fill="#9FB3C8">${xmlEscape(entry.detail)}</text>
        </g>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#07101F"/>
        <stop offset="100%" stop-color="#0B1D34"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" rx="0" fill="url(#bg)" />
    <rect x="48" y="48" width="${width - 96}" height="${height - 96}" rx="36" fill="#081423" stroke="rgba(255,255,255,0.08)" />
    <text x="72" y="108" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#00F0D0">VICTORY FITNESS</text>
    <text x="72" y="156" font-size="54" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">${xmlEscape(thread.title)}</text>
    <text x="72" y="198" font-size="24" font-family="Arial, sans-serif" fill="#9FB3C8">Completed progress only · ${xmlEscape(generatedAt)}</text>
    <rect x="72" y="224" width="222" height="42" rx="21" fill="#00F0D0" fill-opacity="0.14" />
    <text x="92" y="252" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="#00F0D0">${thread.viewer_progress_days_completed}/${thread.duration_days} DAYS</text>
    <rect x="316" y="224" width="220" height="42" rx="21" fill="#F59E0B" fill-opacity="0.14" />
    <text x="336" y="252" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="#F59E0B">${thread.viewer_points_earned}/${thread.points} PTS</text>
    ${content}
    <text x="72" y="${height - 154}" font-size="24" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">Download the app</text>
    <rect x="72" y="${height - 128}" width="270" height="74" rx="20" fill="#111827" stroke="#2A3548" />
    <text x="102" y="${height - 84}" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">▶ Google Play</text>
    <rect x="362" y="${height - 128}" width="270" height="74" rx="20" fill="#111827" stroke="#2A3548" />
    <text x="392" y="${height - 84}" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF"> App Store</text>
    <text x="72" y="${height - 20}" font-size="20" font-family="Arial, sans-serif" fill="#6F8298">Get Victory Fitness on Google Play and the App Store</text>
  </svg>`;
}

function buildProfessionalReportEntries(thread: ChallengeProgressThread, dayProgressMap: Map<number, ChallengePlanDayProgress>) {
  const entries: CompletedReportEntry[] = [];

  for (const day of thread.plan_days) {
    const dayProgress = dayProgressMap.get(day.day_number);
    const completedExerciseIds = new Set(Array.isArray(dayProgress?.completed_exercise_ids) ? dayProgress.completed_exercise_ids : []);
    const completedSectionIds = new Set(Array.isArray(dayProgress?.completed_section_ids) ? dayProgress.completed_section_ids : []);

    for (const section of day.sections) {
      if (completedSectionIds.has(section.id)) {
        if (section.exercises.length > 0) {
          for (const exercise of section.exercises) {
            entries.push({
              title: exercise.name,
              detail: `Day ${day.day_number} | ${section.title}`,
            });
          }
        } else {
          entries.push({
            title: `${section.title} completed`,
            detail: `Day ${day.day_number} | ${day.title}`,
          });
        }
        continue;
      }

      for (const exercise of section.exercises) {
        if (completedExerciseIds.has(exercise.id)) {
          entries.push({
            title: exercise.name,
            detail: `Day ${day.day_number} | ${section.title}`,
          });
        }
      }
    }
  }

  return entries.slice(0, 10);
}

function buildProfessionalChallengeProgressShareMessage(
  thread: ChallengeProgressThread,
  entries: CompletedReportEntry[],
  viewerName: string,
) {
  const totalExerciseCount = thread.plan_days.reduce(
    (total, day) => total + day.sections.reduce((sectionTotal, section) => sectionTotal + section.exercises.length, 0),
    0,
  );
  const completionPercent = totalExerciseCount > 0
    ? Math.round((entries.length / totalExerciseCount) * 100)
    : Math.round((thread.viewer_progress_days_completed / Math.max(thread.duration_days, 1)) * 100);
  const completedLines = entries.length > 0
    ? entries.map((entry) => `- ${entry.title} | ${entry.detail}`).join('\n')
    : '- No completed items yet';

  return [
    'Victory Fitness',
    `Member: ${viewerName}`,
    `${thread.title} progress report`,
    `Completed ${completionPercent}% | ${thread.viewer_progress_days_completed}/${thread.duration_days} days | ${thread.viewer_points_earned}/${thread.points} pts`,
    '',
    completedLines,
    '',
    `Get the app on Google Play: ${GOOGLE_PLAY_URL}`,
    `Get the app on the App Store: ${APP_STORE_URL}`,
  ].join('\n').slice(0, 5000);
}

function buildProfessionalChallengeProgressSvg(
  thread: ChallengeProgressThread,
  entries: CompletedReportEntry[],
  viewerName: string,
) {
  const width = 1080;
  const headerHeight = 430;
  const rowHeight = 72;
  const footerHeight = 290;
  const rows = Math.max(entries.length, 1);
  const height = headerHeight + rows * rowHeight + footerHeight;
  const generatedAt = new Date().toLocaleDateString();
  const totalExerciseCount = thread.plan_days.reduce(
    (total, day) => total + day.sections.reduce((sectionTotal, section) => sectionTotal + section.exercises.length, 0),
    0,
  );
  const completedCount = entries.length;
  const completionPercent = totalExerciseCount > 0
    ? Math.round((completedCount / totalExerciseCount) * 100)
    : Math.round((thread.viewer_progress_days_completed / Math.max(thread.duration_days, 1)) * 100);
  const progressWidth = Math.max(Math.min(completionPercent, 100), 0) * 8.56;
  const safeViewerName = xmlEscape(viewerName || 'Victory Member');
  const safeChallengeName = xmlEscape(thread.title || 'Challenge Progress');
  const completedContent = (entries.length > 0 ? entries : [{ title: 'No completed items yet', detail: 'Finish exercises to build your share card.' }])
    .map((entry, index) => {
      const y = headerHeight + index * rowHeight;
      return `
        <g transform="translate(84 ${y})">
          <circle cx="18" cy="22" r="18" fill="#00F0D0" fill-opacity="0.16" />
          <path d="M9 22 L16 29 L29 15" stroke="#00F0D0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          <text x="52" y="18" font-size="26" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">${xmlEscape(entry.title)}</text>
          <text x="52" y="46" font-size="20" font-family="Arial, sans-serif" fill="#8FA7C1">${xmlEscape(entry.detail)}</text>
        </g>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="report-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#05101C"/>
        <stop offset="45%" stop-color="#0B1F35"/>
        <stop offset="100%" stop-color="#11304E"/>
      </linearGradient>
      <linearGradient id="report-accent" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#00F0D0"/>
        <stop offset="100%" stop-color="#1DD1A1"/>
      </linearGradient>
      <linearGradient id="report-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FBBF24"/>
        <stop offset="100%" stop-color="#F59E0B"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#report-bg)" />
    <circle cx="930" cy="130" r="180" fill="rgba(0,240,208,0.08)" />
    <circle cx="840" cy="20" r="110" fill="rgba(255,255,255,0.04)" />
    <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="42" fill="#081423" stroke="rgba(255,255,255,0.08)" />
    <circle cx="132" cy="128" r="46" fill="url(#report-accent)" />
    <text x="132" y="142" text-anchor="middle" font-size="30" font-family="Arial, sans-serif" font-weight="700" fill="#03131F">VF</text>
    <text x="198" y="100" font-size="24" font-family="Arial, sans-serif" font-weight="700" fill="#00F0D0">VICTORY FITNESS</text>
    <text x="198" y="136" font-size="38" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">${safeViewerName}</text>
    <text x="198" y="168" font-size="20" font-family="Arial, sans-serif" fill="#9FB3C8">Challenge progress report · ${xmlEscape(generatedAt)}</text>
    <text x="84" y="248" font-size="54" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">${safeChallengeName}</text>
    <text x="84" y="286" font-size="24" font-family="Arial, sans-serif" fill="#9FB3C8">${completionPercent}% complete | ${completedCount}/${Math.max(totalExerciseCount, completedCount || 1)} exercises done</text>
    <rect x="84" y="320" width="856" height="18" rx="9" fill="rgba(255,255,255,0.08)" />
    <rect x="84" y="320" width="${progressWidth}" height="18" rx="9" fill="url(#report-accent)" />
    <rect x="84" y="364" width="252" height="74" rx="24" fill="rgba(0,240,208,0.10)" stroke="rgba(0,240,208,0.16)" />
    <text x="110" y="395" font-size="18" font-family="Arial, sans-serif" fill="#7EEAD9">DAYS COMPLETED</text>
    <text x="110" y="424" font-size="29" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">${thread.viewer_progress_days_completed}/${thread.duration_days}</text>
    <rect x="356" y="364" width="252" height="74" rx="24" fill="rgba(245,158,11,0.10)" stroke="rgba(245,158,11,0.16)" />
    <text x="382" y="395" font-size="18" font-family="Arial, sans-serif" fill="#FCD34D">POINTS EARNED</text>
    <text x="382" y="424" font-size="29" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">${thread.viewer_points_earned}/${thread.points}</text>
    <rect x="628" y="364" width="312" height="74" rx="24" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" />
    <text x="654" y="395" font-size="18" font-family="Arial, sans-serif" fill="#C7D2FE">EXERCISES DONE</text>
    <text x="654" y="424" font-size="29" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">${completedCount}</text>
    <text x="84" y="484" font-size="22" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">Completed Exercises</text>
    ${completedContent}
    <text x="84" y="${height - 206}" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">Download Victory Fitness</text>
    <text x="84" y="${height - 172}" font-size="20" font-family="Arial, sans-serif" fill="#9FB3C8">Train with the full app on Google Play and the App Store</text>
    <rect x="84" y="${height - 142}" width="396" height="94" rx="28" fill="#0E1826" stroke="#243244" />
    <polygon points="122,${height - 114} 122,${height - 76} 154,${height - 95}" fill="#34D399" />
    <polygon points="154,${height - 95} 166,${height - 106} 166,${height - 84}" fill="#60A5FA" />
    <polygon points="122,${height - 114} 145,${height - 99} 122,${height - 76}" fill="#F59E0B" />
    <text x="186" y="${height - 102}" font-size="16" font-family="Arial, sans-serif" fill="#9FB3C8">Download on</text>
    <text x="186" y="${height - 70}" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">Google Play</text>
    <rect x="514" y="${height - 142}" width="396" height="94" rx="28" fill="#0E1826" stroke="#243244" />
    <circle cx="556" cy="${height - 95}" r="24" fill="rgba(255,255,255,0.10)" />
    <path d="M548 ${height - 82} L564 ${height - 108} M553 ${height - 80} L569 ${height - 106} M545 ${height - 95} H567" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" />
    <text x="594" y="${height - 102}" font-size="16" font-family="Arial, sans-serif" fill="#9FB3C8">Download on the</text>
    <text x="594" y="${height - 70}" font-size="28" font-family="Arial, sans-serif" font-weight="700" fill="#FFFFFF">App Store</text>
  </svg>`;
}

async function buildChallengeProgressReportAsset(challengeId: string) {
  const response = await apiRequest<{
    file_name: string;
    mime_type: string;
    image_base64: string;
    share_message: string;
  }>(`/challenges/${encodeURIComponent(challengeId)}/progress/report`);

  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
  const fileName = response.file_name || 'victory-fitness-progress-report.png';
  const fileUri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, response.image_base64, { encoding: FileSystem.EncodingType.Base64 });
  return {
    fileUri,
    imageBase64: response.image_base64,
    shareMessage: response.share_message,
    mimeType: response.mime_type || 'image/png',
    fileName,
  };
}

export default function ChallengeProgressScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ challengeId?: string }>();
  const challengeId = Array.isArray(params.challengeId) ? params.challengeId[0] : params.challengeId;

  const [thread, setThread] = useState<ChallengeProgressThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completionUpdatingKey, setCompletionUpdatingKey] = useState('');
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [videoModal, setVideoModal] = useState<{ title: string; vimeoId: string } | null>(null);
  const [reportAction, setReportAction] = useState<'download' | 'community' | ''>('');
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  const canUpdateProgress = useMemo(
    () => Boolean(thread && thread.viewer_membership_status === 'ACTIVE' && thread.status === 'ACTIVE'),
    [thread],
  );

  const dayProgressMap = useMemo(() => {
    const map = new Map<number, ChallengePlanDayProgress>();
    for (const dayProgress of thread?.viewer_plan_progress || []) {
      map.set(dayProgress.day_number, dayProgress);
    }
    return map;
  }, [thread?.viewer_plan_progress]);

  const currentPlanDayNumber = useMemo(() => {
    if (!thread) {
      return null;
    }
    const nextIncompleteDay = thread.plan_days.find((day) => !dayProgressMap.get(day.day_number)?.completed);
    return nextIncompleteDay?.day_number ?? null;
  }, [dayProgressMap, thread]);

  const unitPointMap = useMemo(
    () => buildUnitPointMap(thread?.plan_days || [], thread?.points || 0),
    [thread?.plan_days, thread?.points],
  );

  const loadThread = useCallback(async (showLoader = false) => {
    if (!challengeId) {
      return;
    }

    if (showLoader) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const response = await apiRequest<ChallengeProgressThread>(`/challenges/${encodeURIComponent(challengeId)}/chat`);
      setThread(response);
      setExpandedDays((current) => {
        if (Object.keys(current).length > 0) {
          return current;
        }
        const nextIncompleteDay = response.plan_days.find((day) => !response.viewer_plan_progress.find((item) => item.day_number === day.day_number)?.completed);
        return nextIncompleteDay ? { [nextIncompleteDay.day_number]: true } : {};
      });
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to load challenge progress.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [challengeId]);

  useEffect(() => {
    void loadThread(true);
  }, [loadThread]);

  const applyPlanProgress = useCallback((response: ChallengePlanProgressResponse) => {
    setThread((current) => {
      if (!current || current.challenge_id !== response.challenge_id) {
        return current;
      }
      return {
        ...current,
        viewer_membership_status: response.viewer_membership_status,
        viewer_progress_days_completed: response.viewer_progress_days_completed,
        viewer_points_earned: response.viewer_points_earned,
        viewer_plan_progress: Array.isArray(response.viewer_plan_progress) ? response.viewer_plan_progress : [],
      };
    });
  }, []);

  const openLinkedWorkout = useCallback((exercise: ChallengePlanExercise) => {
    if (!exercise.workout_vimeo_id) {
      return;
    }
    setVideoModal({
      title: exercise.workout_title || `${exercise.name} Demo`,
      vimeoId: exercise.workout_vimeo_id,
    });
  }, []);

  const videoEmbedUrl = useMemo(() => {
    if (!videoModal?.vimeoId) {
      return '';
    }
    return `https://player.vimeo.com/video/${encodeURIComponent(videoModal.vimeoId)}?autoplay=1&title=0&byline=0&portrait=0&playsinline=1&dnt=1`;
  }, [videoModal]);

  const videoPlayerHtml = useMemo(() => (videoEmbedUrl ? buildWorkoutPlayerHtml(videoEmbedUrl) : ''), [videoEmbedUrl]);

  const toggleDayExpanded = useCallback((dayNumber: number) => {
    setExpandedDays((current) => ({ ...current, [dayNumber]: !current[dayNumber] }));
  }, []);

  const toggleSectionExpanded = useCallback((sectionId: string) => {
    setExpandedSections((current) => ({ ...current, [sectionId]: !current[sectionId] }));
  }, []);

  const toggleExerciseCompletion = useCallback(async (dayNumber: number, sectionId: string, exerciseId: string, completed: boolean) => {
    if (!challengeId) {
      return;
    }
    const key = `exercise-${dayNumber}-${exerciseId}`;
    setCompletionUpdatingKey(key);
    try {
      const response = await apiRequest<ChallengePlanProgressResponse>(
        `/challenges/${encodeURIComponent(challengeId)}/plan/days/${dayNumber}/exercises/${encodeURIComponent(exerciseId)}/complete`,
        {
          method: 'POST',
          body: { completed },
        }
      );
      applyPlanProgress(response);
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to update exercise completion.'));
    } finally {
      setCompletionUpdatingKey('');
    }
  }, [applyPlanProgress, challengeId]);

  const toggleSectionCompletion = useCallback(async (dayNumber: number, sectionId: string, completed: boolean) => {
    if (!challengeId) {
      return;
    }
    const key = `section-${dayNumber}-${sectionId}`;
    setCompletionUpdatingKey(key);
    try {
      const response = await apiRequest<ChallengePlanProgressResponse>(
        `/challenges/${encodeURIComponent(challengeId)}/plan/days/${dayNumber}/sections/${encodeURIComponent(sectionId)}/complete`,
        {
          method: 'POST',
          body: { completed },
        }
      );
      applyPlanProgress(response);
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to update section completion.'));
    } finally {
      setCompletionUpdatingKey('');
    }
  }, [applyPlanProgress, challengeId]);

  const toggleDayCompletion = useCallback(async (dayNumber: number, completed: boolean) => {
    if (!challengeId) {
      return;
    }
    const key = `day-${dayNumber}`;
    setCompletionUpdatingKey(key);
    try {
      const response = await apiRequest<ChallengePlanProgressResponse>(
        `/challenges/${encodeURIComponent(challengeId)}/plan/days/${dayNumber}/complete`,
        {
          method: 'POST',
          body: { completed },
        }
      );
      applyPlanProgress(response);
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to update day completion.'));
    } finally {
      setCompletionUpdatingKey('');
    }
  }, [applyPlanProgress, challengeId]);

  const confirmDayCompletion = useCallback((dayNumber: number, completed: boolean) => {
    if (!completed) {
      void toggleDayCompletion(dayNumber, completed);
      return;
    }

    Alert.alert(
      'Mark day done',
      `Are you sure you want to mark day ${dayNumber} as complete?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            void toggleDayCompletion(dayNumber, completed);
          },
        },
      ],
    );
  }, [toggleDayCompletion]);

  const handleDownloadReport = useCallback(async () => {
    if (!thread) {
      return;
    }
    setReportAction('download');
    try {
      const asset = await buildChallengeProgressReportAsset(thread.challenge_id);
      await Share.share({
        title: `${thread?.title || 'Challenge'} Progress Report`,
        url: asset.fileUri,
        message: asset.shareMessage,
      });
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to export the progress report.'));
    } finally {
      setReportAction('');
    }
  }, [thread]);

  const handleShareReportToCommunity = useCallback(async () => {
    if (!thread) {
      return;
    }

    setReportAction('community');
    try {
      const asset = await buildChallengeProgressReportAsset(thread.challenge_id);
      router.push({
        pathname: '/challenge',
        params: {
          tab: 'COMMUNITY',
          prefillSource: 'challenge-report',
          prefillChallengeId: thread.challenge_id,
          prefillImageUri: asset.fileUri,
          prefillImageMimeType: 'image/svg+xml',
          prefillImageFileName: 'victory-fitness-progress-report.svg',
        },
      });
    } catch (error) {
      setErrorDialog(formatAppError(error, 'Failed to prepare the progress report for community sharing.'));
    } finally {
      setReportAction('');
    }
  }, [router, thread]);

  if (loading && !thread) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ErrorPopupModal
        visible={Boolean(errorDialog)}
        title={errorDialog?.title ?? 'Error'}
        message={errorDialog?.message ?? ''}
        onClose={() => setErrorDialog(null)}
      />
      <Modal
        visible={Boolean(videoModal)}
        animationType="slide"
        transparent
        onRequestClose={() => setVideoModal(null)}
      >
        <View style={styles.videoModalBackdrop}>
          <View style={styles.videoModalCard}>
            <View style={styles.videoModalHeader}>
              <TouchableOpacity onPress={() => setVideoModal(null)} style={styles.videoModalButton}>
                <Ionicons name="arrow-back" size={20} color="#fff" />
              </TouchableOpacity>
              <View style={styles.videoModalSpacer} />
              <TouchableOpacity onPress={() => setVideoModal(null)} style={styles.videoModalButton}>
                <Ionicons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.videoModalPlayerWrap}>
              {videoEmbedUrl ? (
                <WebView
                  source={{ html: videoPlayerHtml }}
                  style={styles.videoModalWebview}
                  originWhitelist={['*']}
                  javaScriptEnabled
                  domStorageEnabled
                  mediaPlaybackRequiresUserAction={false}
                  allowsInlineMediaPlayback
                  setSupportMultipleWindows={false}
                  javaScriptCanOpenWindowsAutomatically={false}
                  onShouldStartLoadWithRequest={(request) => isAllowedWorkoutPlayerRequest(request.url)}
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.videoModalLoadingWrap}>
                      <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                  )}
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>{thread?.title || 'Challenge Progress'}</Text>
          <Text style={styles.headerMeta}>{thread?.category || 'Challenge'} progress</Text>
        </View>
        <TouchableOpacity onPress={() => void handleDownloadReport()} style={styles.headerIcon} disabled={!thread || reportAction !== ''}>
          {reportAction === 'download' ? <ActivityIndicator color={Colors.primary} size="small" /> : <Ionicons name="download-outline" size={20} color="#fff" />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void handleShareReportToCommunity()} style={styles.headerIcon} disabled={!thread || reportAction !== ''}>
          {reportAction === 'community' ? <ActivityIndicator color={Colors.primary} size="small" /> : <Ionicons name="share-social-outline" size={20} color="#fff" />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void loadThread(false)} style={styles.headerIcon}>
          {refreshing ? <ActivityIndicator color={Colors.primary} size="small" /> : <Ionicons name="refresh" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadThread(false)}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {thread ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroDescription}>{thread.description}</Text>
              <View style={styles.heroMetaRow}>
                <Text style={styles.heroMeta}>{thread.difficulty}</Text>
                <Text style={[styles.heroMeta, thread.status !== 'ACTIVE' && styles.heroMetaMuted]}>{thread.status}</Text>
                <Text style={styles.heroMeta}>{thread.viewer_progress_days_completed}/{thread.duration_days} days</Text>
                <Text style={styles.heroMeta}>{thread.viewer_points_earned}/{thread.points} pts</Text>
              </View>
              <TouchableOpacity
                style={styles.chatShortcut}
                onPress={() => router.push(`/challenges/chat/${thread.challenge_id}` as any)}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#001311" />
                <Text style={styles.chatShortcutText}>Open challenge chat</Text>
              </TouchableOpacity>
            </View>

            {!canUpdateProgress ? (
              <View style={styles.statusNotice}>
                <Text style={styles.statusNoticeText}>
                  {thread.status === 'UPCOMING'
                    ? 'This challenge is upcoming. Progress tracking unlocks when the challenge becomes active.'
                    : thread.status === 'ARCHIVED'
                      ? 'This challenge has been archived. Progress is read-only.'
                      : thread.viewer_membership_status !== 'ACTIVE'
                        ? 'Your membership is no longer active. Progress is read-only.'
                        : 'Progress is read-only right now.'}
                </Text>
              </View>
            ) : null}

            <View style={styles.legendCard}>
              <Text style={styles.legendTitle}>Daily Progress</Text>
              <Text style={styles.legendText}>Tap a day row or the arrow to open its sections. Tap a section row to open exercises and mark each one complete.</Text>
            </View>

            <View style={styles.dayList}>
              {thread.plan_days.map((day) => {
                const dayProgress = dayProgressMap.get(day.day_number);
                const isExpanded = Boolean(expandedDays[day.day_number]);
                const isCurrentDay = currentPlanDayNumber === day.day_number;
                const progressFraction = getDayProgressFraction(day, dayProgress);
                const dayPoints = getDayPoints(day, unitPointMap);
                const completedExerciseIds = Array.isArray(dayProgress?.completed_exercise_ids) ? dayProgress.completed_exercise_ids : [];
                const completedSectionIds = Array.isArray(dayProgress?.completed_section_ids) ? dayProgress.completed_section_ids : [];
                const dayExerciseCount = day.sections.flatMap((section) => section.exercises).length;
                const completedExerciseCount = day.sections.reduce((total, section) => {
                  if (completedSectionIds.includes(section.id)) {
                    return total + section.exercises.length;
                  }
                  return total + getSectionCompletedCount(section, completedExerciseIds);
                }, 0);
                const allSectionsCompleted = day.sections.every((section) => completedSectionIds.includes(section.id));

                return (
                  <View key={`day-${day.day_number}`} style={[styles.dayCard, dayProgress?.completed && styles.dayCardCompleted]}>
                    <TouchableOpacity style={styles.dayRow} activeOpacity={0.88} onPress={() => toggleDayExpanded(day.day_number)}>
                      <View style={styles.dayLeft}>
                        <View style={[styles.dayNumberBadge, isCurrentDay && styles.dayNumberBadgeCurrent, dayProgress?.completed && styles.dayNumberBadgeCompleted]}>
                          <Text style={[styles.dayNumberText, dayProgress?.completed && styles.dayNumberTextCompleted]}>D{day.day_number}</Text>
                        </View>
                        <View style={styles.dayTextWrap}>
                          <Text style={styles.dayTitle}>{day.title}</Text>
                          <Text style={styles.dayFocus}>{day.focus}</Text>
                        </View>
                      </View>
                      <View style={styles.dayRight}>
                        <View style={styles.dayPointsBadge}>
                          <Text style={styles.dayPointsText}>{dayPoints} pts</Text>
                        </View>
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-forward'} size={18} color={Colors.textMuted} />
                      </View>
                    </TouchableOpacity>

                    <View style={styles.dayProgressBarBg}>
                      <View style={[styles.dayProgressBarFill, { width: `${Math.max(progressFraction * 100, dayProgress?.completed ? 100 : 0)}%` }]} />
                    </View>

                    <View style={styles.dayMetaRow}>
                      <Text style={styles.dayMetaText}>
                        {dayExerciseCount > 0 ? `${completedExerciseCount}/${dayExerciseCount} exercises completed` : `${day.sections.length} sections`}
                      </Text>
                      {isCurrentDay && !dayProgress?.completed ? <Text style={styles.dayCurrentLabel}>Today</Text> : null}
                    </View>

                    {isExpanded ? (
                      <View style={styles.dayDetails}>
                        {day.notes ? <Text style={styles.dayNotes}>{day.notes}</Text> : null}
                        {!allSectionsCompleted ? (
                          <Text style={styles.helperText}>Finish all exercises in all sections, then mark the day done.</Text>
                        ) : null}

                        {day.sections.map((section) => {
                          const sectionKey = `${day.day_number}:${section.id}`;
                          const sectionExpanded = Boolean(expandedSections[sectionKey]);
                          const sectionPoints = getSectionPoints(section, unitPointMap);
                          const sectionCompleted = Boolean(completedSectionIds.includes(section.id));
                          const completedCount = sectionCompleted ? section.exercises.length : getSectionCompletedCount(section, completedExerciseIds);
                          const totalCount = section.exercises.length;

                          return (
                            <View key={section.id} style={[styles.sectionCard, sectionCompleted && styles.sectionCardCompleted]}>
                              <TouchableOpacity style={styles.sectionRow} activeOpacity={0.88} onPress={() => toggleSectionExpanded(sectionKey)}>
                                <View style={styles.sectionLeft}>
                                  <View style={[styles.sectionStatusDot, sectionCompleted && styles.sectionStatusDotCompleted]} />
                                  <View style={styles.sectionTextWrap}>
                                    <Text style={styles.sectionTitle}>{section.title}</Text>
                                    <Text style={styles.sectionDescription}>
                                      {section.description || `${section.estimated_minutes} min`}
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.sectionRight}>
                                  <View style={styles.sectionPointsBadge}>
                                    <Text style={styles.sectionPointsText}>{sectionPoints} pts</Text>
                                  </View>
                                  <Ionicons name={sectionExpanded ? 'chevron-up' : 'chevron-forward'} size={18} color={Colors.textMuted} />
                                </View>
                              </TouchableOpacity>

                              <View style={styles.sectionMetaRow}>
                                <Text style={styles.sectionMetaText}>
                                  {totalCount > 0 ? `${completedCount}/${totalCount} exercises` : `${section.estimated_minutes} min`}
                                </Text>
                                <TouchableOpacity
                                  style={[
                                    styles.compactButton,
                                    sectionCompleted && styles.compactButtonCompleted,
                                    (!canUpdateProgress || sectionCompleted) && styles.buttonDisabled,
                                  ]}
                                  disabled={!canUpdateProgress || sectionCompleted || completionUpdatingKey === `section-${day.day_number}-${section.id}`}
                                  onPress={() => void toggleSectionCompletion(day.day_number, section.id, !sectionCompleted)}
                                >
                                  {completionUpdatingKey === `section-${day.day_number}-${section.id}` ? (
                                    <ActivityIndicator size="small" color="#001311" />
                                  ) : (
                                    <Text style={[styles.compactButtonText, sectionCompleted && styles.compactButtonTextCompleted]}>
                                      {sectionCompleted ? 'Completed' : 'Complete section'}
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              </View>

                              {sectionExpanded ? (
                                <View style={styles.exerciseList}>
                                  {section.exercises.map((exercise) => {
                                    const exerciseCompleted = isExerciseCompleted(section, exercise.id, completedExerciseIds, completedSectionIds);
                                    const exerciseKey = `exercise-${day.day_number}-${exercise.id}`;
                                    return (
                                      <View key={exercise.id} style={[styles.exerciseCard, exerciseCompleted && styles.exerciseCardCompleted]}>
                                        <TouchableOpacity
                                          style={[
                                            styles.exerciseCheck,
                                            exerciseCompleted && styles.exerciseCheckCompleted,
                                            (!canUpdateProgress || exerciseCompleted) && styles.buttonDisabled,
                                          ]}
                                          disabled={!canUpdateProgress || exerciseCompleted || completionUpdatingKey === exerciseKey}
                                          onPress={() => void toggleExerciseCompletion(day.day_number, section.id, exercise.id, !exerciseCompleted)}
                                        >
                                          {completionUpdatingKey === exerciseKey ? (
                                            <ActivityIndicator size="small" color={exerciseCompleted ? '#001311' : Colors.primary} />
                                          ) : (
                                            <View style={styles.exerciseCheckContent}>
                                              <Ionicons
                                                name={exerciseCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                                                size={16}
                                                color={exerciseCompleted ? '#001311' : Colors.primary}
                                              />
                                              <Text style={[styles.exerciseCheckText, exerciseCompleted && styles.exerciseCheckTextCompleted]}>
                                                {exerciseCompleted ? 'Completed' : 'Complete'}
                                              </Text>
                                            </View>
                                          )}
                                        </TouchableOpacity>
                                        <View style={styles.exerciseTextWrap}>
                                          <View style={styles.exerciseTopRow}>
                                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                                            <Text style={styles.exercisePoints}>{unitPointMap[exercise.id] || 0} pts</Text>
                                          </View>
                                          <Text style={styles.exerciseDetails}>{exercise.details}</Text>
                                          {exercise.notes ? <Text style={styles.exerciseNotes}>{exercise.notes}</Text> : null}
                                          {exercise.workout_vimeo_id ? (
                                            <TouchableOpacity onPress={() => openLinkedWorkout(exercise)} style={styles.videoButton} activeOpacity={0.85}>
                                              <Ionicons name="play-circle" size={15} color="#001311" />
                                              <Text style={styles.videoButtonText}>Instruction video</Text>
                                            </TouchableOpacity>
                                          ) : null}
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}

                        <TouchableOpacity
                          style={[
                            styles.dayDoneButton,
                            dayProgress?.completed && styles.dayDoneButtonCompleted,
                            (!canUpdateProgress || (!dayProgress?.completed && !allSectionsCompleted)) && styles.buttonDisabled,
                          ]}
                          disabled={!canUpdateProgress || completionUpdatingKey === `day-${day.day_number}` || (!dayProgress?.completed && !allSectionsCompleted)}
                          onPress={() => confirmDayCompletion(day.day_number, !Boolean(dayProgress?.completed))}
                        >
                          {completionUpdatingKey === `day-${day.day_number}` ? (
                            <ActivityIndicator size="small" color={dayProgress?.completed ? '#001311' : Colors.primary} />
                          ) : (
                            <>
                              <Ionicons
                                name={dayProgress?.completed ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                size={18}
                                color={dayProgress?.completed ? '#001311' : Colors.primary}
                              />
                              <Text style={[styles.dayDoneButtonText, dayProgress?.completed && styles.dayDoneButtonTextCompleted]}>
                                {dayProgress?.completed ? 'Day completed' : 'Mark day done'}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerBody: { flex: 1, marginHorizontal: 12 },
  headerTitle: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  headerMeta: { color: Colors.textMuted, fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  videoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
  },
  videoModalCard: {
    flex: 1,
    backgroundColor: '#050816',
  },
  videoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  videoModalButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModalSpacer: {
    flex: 1,
  },
  videoModalPlayerWrap: {
    flex: 1,
    backgroundColor: '#050816',
  },
  videoModalWebview: {
    flex: 1,
    backgroundColor: '#050816',
  },
  videoModalLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050816',
  },
  scrollContent: { padding: 16, paddingBottom: 28, gap: 14 },
  heroCard: {
    borderRadius: 18,
    backgroundColor: '#0D1526',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  heroDescription: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  heroMetaRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  heroMeta: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    backgroundColor: 'rgba(0,240,208,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroMetaMuted: {
    color: '#F59E0B',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  chatShortcut: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chatShortcutText: { color: '#001311', fontSize: 12, fontFamily: 'Inter_700Bold' },
  statusNotice: {
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.16)',
    padding: 12,
  },
  statusNoticeText: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  legendCard: {
    borderRadius: 16,
    backgroundColor: '#101827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  legendTitle: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  legendText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 6 },
  dayList: { gap: 12 },
  dayCard: {
    borderRadius: 18,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    gap: 10,
  },
  dayCardCompleted: {
    backgroundColor: '#0E1A16',
    borderColor: 'rgba(34,197,94,0.24)',
  },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  dayLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dayNumberBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumberBadgeCurrent: { backgroundColor: 'rgba(0,240,208,0.16)', borderWidth: 1, borderColor: 'rgba(0,240,208,0.3)' },
  dayNumberBadgeCompleted: { backgroundColor: Colors.primary },
  dayNumberText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  dayNumberTextCompleted: { color: '#001311' },
  dayTextWrap: { flex: 1 },
  dayTitle: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  dayFocus: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 2 },
  dayRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayPointsBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(245,158,11,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dayPointsText: { color: '#F59E0B', fontSize: 11, fontFamily: 'Inter_700Bold' },
  dayProgressBarBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  dayProgressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  dayMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayMetaText: { color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' },
  dayCurrentLabel: { color: Colors.primary, fontSize: 11, fontFamily: 'Inter_700Bold' },
  dayDetails: { gap: 10, marginTop: 4 },
  dayNotes: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  helperText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' },
  sectionCard: {
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    gap: 8,
  },
  sectionCardCompleted: {
    backgroundColor: '#122019',
    borderColor: 'rgba(34,197,94,0.22)',
  },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sectionStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  sectionStatusDotCompleted: { backgroundColor: Colors.primary },
  sectionTextWrap: { flex: 1 },
  sectionTitle: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  sectionDescription: { color: Colors.textSecondary, fontSize: 11, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 2 },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionPointsBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(0,240,208,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  sectionPointsText: { color: Colors.primary, fontSize: 10, fontFamily: 'Inter_700Bold' },
  sectionMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionMetaText: { color: Colors.textMuted, fontSize: 11, fontFamily: 'Inter_400Regular' },
  compactButton: {
    borderRadius: 999,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compactButtonCompleted: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.28)',
  },
  compactButtonText: { color: '#001311', fontSize: 11, fontFamily: 'Inter_700Bold' },
  compactButtonTextCompleted: { color: '#DCFCE7' },
  exerciseList: { gap: 8, marginTop: 4 },
  exerciseCard: {
    borderRadius: 12,
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  exerciseCardCompleted: {
    backgroundColor: '#0E1A16',
    borderColor: 'rgba(34,197,94,0.2)',
  },
  exerciseCheck: {
    minWidth: 34,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,240,208,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,240,208,0.22)',
  },
  exerciseCheckCompleted: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  exerciseCheckContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exerciseCheckText: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  exerciseCheckTextCompleted: {
    color: '#001311',
  },
  exerciseTextWrap: { flex: 1 },
  exerciseTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  exerciseName: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold', flex: 1 },
  exercisePoints: { color: '#F59E0B', fontSize: 11, fontFamily: 'Inter_700Bold' },
  exerciseDetails: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 3 },
  exerciseNotes: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 3 },
  videoButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  videoButtonText: { color: '#001311', fontSize: 11, fontFamily: 'Inter_700Bold' },
  dayDoneButton: {
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,240,208,0.24)',
    backgroundColor: 'rgba(0,240,208,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dayDoneButtonCompleted: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayDoneButtonText: { color: Colors.primary, fontSize: 12, fontFamily: 'Inter_700Bold' },
  dayDoneButtonTextCompleted: { color: '#001311' },
  buttonDisabled: { opacity: 0.5 },
});
