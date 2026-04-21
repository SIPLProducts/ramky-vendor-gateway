import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Step } from './EnterpriseStepIndicator';

interface HorizontalStepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
}

/**
 * Sticky horizontal stepper rendered above the form card.
 * - Numbered circles connected by a progress line.
 * - Step title under each circle (description shown only on xl).
 * - Click-to-jump for completed/visited steps.
 */
export function HorizontalStepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: HorizontalStepIndicatorProps) {
  const maxVisited = Math.max(currentStep, ...completedSteps, 0);
  const canNavigateToStep = (id: number) => completedSteps.includes(id) || id <= maxVisited;

  return (
    <nav aria-label="Registration progress" className="w-full">
      <ol className="flex items-start justify-between gap-1 sm:gap-2">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isLast = index === steps.length - 1;
          const canClick = !!onStepClick && canNavigateToStep(step.id);
          const lineActive = isCompleted || step.id < currentStep;

          return (
            <li key={step.id} className="flex-1 flex flex-col items-center min-w-0 relative">
              {/* Connector line — sits behind the next circle */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute top-4 left-1/2 w-full h-0.5 -z-0',
                    lineActive ? 'bg-primary' : 'bg-border',
                  )}
                  aria-hidden
                />
              )}

              <button
                type="button"
                onClick={() => canClick && onStepClick(step.id)}
                disabled={!canClick}
                className={cn(
                  'relative z-10 flex flex-col items-center gap-1.5 group min-w-0 w-full',
                  canClick ? 'cursor-pointer' : 'cursor-default',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors bg-card',
                    isCompleted && 'bg-primary text-primary-foreground border-primary',
                    isCurrent && !isCompleted && 'border-primary text-primary ring-4 ring-primary/15',
                    !isCurrent && !isCompleted && 'border-border text-muted-foreground',
                    canClick && !isCurrent && 'group-hover:border-primary/60',
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                </div>

                <div className="text-center min-w-0 px-0.5">
                  <p
                    className={cn(
                      'text-[11px] sm:text-xs font-medium leading-tight truncate',
                      isCurrent && 'text-primary',
                      isCompleted && 'text-foreground',
                      !isCurrent && !isCompleted && 'text-muted-foreground',
                    )}
                    title={step.title}
                  >
                    {step.title}
                  </p>
                  <p className="hidden xl:block text-[10px] text-muted-foreground mt-0.5 truncate" title={step.description}>
                    {step.description}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
