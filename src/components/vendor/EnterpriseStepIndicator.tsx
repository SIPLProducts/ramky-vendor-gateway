import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  id: number;
  title: string;
  description: string;
}

interface EnterpriseStepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
}

export function EnterpriseStepIndicator({ 
  steps, 
  currentStep, 
  completedSteps,
  onStepClick 
}: EnterpriseStepIndicatorProps) {
  const canNavigateToStep = (stepId: number) => {
    return completedSteps.includes(stepId) || stepId <= Math.max(...completedSteps, currentStep);
  };

  return (
    <nav className="w-full" aria-label="Progress">
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isLast = index === steps.length - 1;
          const canClick = onStepClick && canNavigateToStep(step.id);

          return (
            <li 
              key={step.id} 
              className={cn(
                "step-item",
                isCompleted && "completed"
              )}
            >
              <button
                type="button"
                onClick={() => canClick && onStepClick(step.id)}
                disabled={!canClick}
                className={cn(
                  "flex items-start gap-4 w-full text-left transition-colors",
                  canClick && "cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg",
                  !canClick && "cursor-default"
                )}
              >
                <div
                  className={cn(
                    "step-circle",
                    isCompleted && "completed",
                    isCurrent && !isCompleted && "active",
                    !isCurrent && !isCompleted && "pending"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    step.id
                  )}
                </div>
                
                <div className="pt-1.5 min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    isCurrent && "text-primary",
                    isCompleted && "text-foreground",
                    !isCurrent && !isCompleted && "text-muted-foreground"
                  )}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
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

export const registrationSteps: Step[] = [
  { id: 1, title: 'Organization Profile', description: 'Company details and verification' },
  { id: 2, title: 'Address Information', description: 'Registered and branch addresses' },
  { id: 3, title: 'Contact Information', description: 'Key contact persons' },
  { id: 4, title: 'Financial Information', description: 'Turnover and credit terms' },
  { id: 5, title: 'Review & Submit', description: 'Verify and submit application' },
];
