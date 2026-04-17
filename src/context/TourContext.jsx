import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ACTIONS, EVENTS, Joyride, STATUS } from 'react-joyride';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { authAPI } from '../services/api';
import { TOUR_STORAGE_KEY, TOUR_STEPS, filterTourStepsByAccess } from '../utils/tourConfig';

const TourContext = createContext(null);

function getTourStorageKey(userId) {
  return userId ? `${TOUR_STORAGE_KEY}:${userId}` : TOUR_STORAGE_KEY;
}

function readTourState(userId) {
  if (typeof window === 'undefined') {
    return { completed: false, skipped: false };
  }

  try {
    const raw = window.localStorage.getItem(getTourStorageKey(userId));
    if (!raw) return { completed: false, skipped: false };
    const parsed = JSON.parse(raw);
    return {
      completed: !!parsed?.completed,
      skipped: !!parsed?.skipped,
      lastSeenAt: parsed?.lastSeenAt || null,
    };
  } catch {
    return { completed: false, skipped: false };
  }
}

function writeTourState(userId, nextState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getTourStorageKey(userId),
      JSON.stringify({
        completed: !!nextState.completed,
        skipped: !!nextState.skipped,
        lastSeenAt: new Date().toISOString(),
      })
    );
  } catch {
    // no-op
  }
}

export function TourProvider({ children }) {
  const { user, loading: authLoading, isAuthenticated, hasTabAccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [pendingStepIndex, setPendingStepIndex] = useState(null);
  const [tourState, setTourState] = useState({ completed: false, skipped: false });

  const startedRef = useRef(false);

  const steps = useMemo(() => {
    return filterTourStepsByAccess(TOUR_STEPS, hasTabAccess);
  }, [hasTabAccess]);

  const backendTourState = String(user?.onboardingTour?.state || '').trim().toLowerCase();
  const backendShouldStart = !!user?.onboardingTour?.shouldStart;

  useEffect(() => {
    const localState = readTourState(user?.uid || null);
    if (backendTourState === 'completed') {
      setTourState({ ...localState, completed: true, skipped: false });
    } else if (backendTourState === 'skipped') {
      setTourState({ ...localState, completed: false, skipped: true });
    } else {
      setTourState(localState);
    }
    startedRef.current = false;
  }, [user?.uid, backendTourState]);

  const syncBackendState = React.useCallback(async (state) => {
    try {
      await authAPI.updateOnboardingTourState(state);
    } catch {
      // Keep UI responsive even if network sync fails.
    }
  }, []);

  const stopTour = React.useCallback(() => {
    setRun(false);
    setPendingStepIndex(null);
  }, []);

  const completeTour = React.useCallback(() => {
    const nextState = { completed: true, skipped: false };
    setTourState(nextState);
    writeTourState(user?.uid || null, nextState);
    syncBackendState('completed');
    setRun(false);
    setPendingStepIndex(null);
  }, [user?.uid, syncBackendState]);

  const skipTour = React.useCallback(() => {
    const nextState = { completed: false, skipped: true };
    setTourState(nextState);
    writeTourState(user?.uid || null, nextState);
    syncBackendState('skipped');
    setRun(false);
    setPendingStepIndex(null);
  }, [user?.uid, syncBackendState]);

  const startTour = React.useCallback(
    ({ force = false } = {}) => {
      if (!steps.length) return false;
      if (!force && !backendShouldStart) return false;
      if (!force && (tourState.completed || tourState.skipped)) return false;
      setStepIndex(0);
      setPendingStepIndex(null);
      const firstRoute = steps[0]?.route || '/dashboard';
      if (location.pathname !== firstRoute) {
        navigate(firstRoute);
      }
      setRun(true);
      syncBackendState('in_progress');
      return true;
    },
    [steps, backendShouldStart, tourState.completed, tourState.skipped, location.pathname, navigate, syncBackendState]
  );

  const replayTour = React.useCallback(() => {
    const resetState = { completed: false, skipped: false };
    setTourState(resetState);
    writeTourState(user?.uid || null, resetState);
    syncBackendState('in_progress');
    startTour({ force: true });
  }, [startTour, user?.uid, syncBackendState]);

  useEffect(() => {
    const hasToken = typeof window !== 'undefined' ? !!window.localStorage.getItem('authToken') : false;
    if (authLoading || startedRef.current) return;
    if (!isAuthenticated || !hasToken) return;
    if (location.pathname === '/login') return;
    const didStart = startTour({ force: false });
    if (didStart || tourState.completed || tourState.skipped) {
      startedRef.current = true;
    }
  }, [authLoading, isAuthenticated, location.pathname, startTour, tourState.completed, tourState.skipped]);

  useEffect(() => {
    if (pendingStepIndex === null) return;
    const targetRoute = steps[pendingStepIndex]?.route;
    if (!targetRoute || targetRoute !== location.pathname) return;

    const timer = window.setTimeout(() => {
      setStepIndex(pendingStepIndex);
      setPendingStepIndex(null);
      setRun(true);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [pendingStepIndex, location.pathname, steps]);

  const handleJoyrideCallback = React.useCallback(
    (data) => {
      const { action, index, status, type } = data;

      if (status === STATUS.FINISHED) {
        completeTour();
        return;
      }

      if (status === STATUS.SKIPPED) {
        skipTour();
        return;
      }

      if (type !== EVENTS.STEP_AFTER && type !== EVENTS.TARGET_NOT_FOUND) {
        return;
      }

      const direction = action === ACTIONS.PREV ? -1 : 1;
      const nextIndex = index + direction;

      if (nextIndex < 0) {
        setStepIndex(0);
        return;
      }

      if (nextIndex >= steps.length) {
        completeTour();
        return;
      }

      const nextStep = steps[nextIndex];
      if (nextStep?.route && location.pathname !== nextStep.route) {
        setRun(false);
        setPendingStepIndex(nextIndex);
        navigate(nextStep.route);
        return;
      }

      setStepIndex(nextIndex);
    },
    [steps, location.pathname, navigate, completeTour, skipTour]
  );

  const value = {
    run,
    steps,
    stepIndex,
    tourState,
    startTour,
    stopTour,
    skipTour,
    completeTour,
    replayTour,
  };

  return (
    <TourContext.Provider value={value}>
      {children}
      <Joyride
        run={run}
        stepIndex={stepIndex}
        steps={steps}
        callback={handleJoyrideCallback}
        continuous={true}
        showProgress={true}
        disableCloseOnEsc={false}
        disableOverlayClose={true}
        scrollToFirstStep={true}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip',
        }}
        styles={{
          options: {
            primaryColor: '#2563eb',
            zIndex: 12000,
          },
        }}
      />
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within TourProvider');
  }
  return context;
}
