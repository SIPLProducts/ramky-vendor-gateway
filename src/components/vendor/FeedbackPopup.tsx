import React, { useState } from 'react';
import { Star, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FeedbackPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId?: string;
}

export const FeedbackPopup = React.forwardRef<HTMLDivElement, FeedbackPopupProps>(({ open, onOpenChange, vendorId }, ref) => {
  const [overallRating, setOverallRating] = useState(0);
  const [easeOfUseRating, setEaseOfUseRating] = useState(0);
  const [supportRating, setSupportRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (overallRating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please provide an overall rating.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('vendor_feedback').insert({
        vendor_id: vendorId || null,
        user_id: user?.id || null,
        overall_rating: overallRating,
        ease_of_use_rating: easeOfUseRating || null,
        support_rating: supportRating || null,
        would_recommend: wouldRecommend,
        comments: comments || null,
      });

      if (error) throw error;

      toast({
        title: 'Thank You!',
        description: 'Your feedback has been submitted successfully.',
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Submission Failed',
        description: 'Could not submit feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  const StarRating = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: number; 
    onChange: (val: number) => void; 
    label: string;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                star <= value
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/30 hover:text-yellow-400/50'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">How was your experience?</DialogTitle>
          <DialogDescription>
            Your feedback helps us improve the vendor registration process.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overall Rating */}
          <StarRating
            value={overallRating}
            onChange={setOverallRating}
            label="Overall Experience *"
          />

          {/* Ease of Use */}
          <StarRating
            value={easeOfUseRating}
            onChange={setEaseOfUseRating}
            label="Ease of Use"
          />

          {/* Support Rating */}
          <StarRating
            value={supportRating}
            onChange={setSupportRating}
            label="Help & Support"
          />

          {/* Would Recommend */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Would you recommend this portal?</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={wouldRecommend === true ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWouldRecommend(true)}
                className="flex-1"
              >
                Yes
              </Button>
              <Button
                type="button"
                variant={wouldRecommend === false ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWouldRecommend(false)}
                className="flex-1"
              >
                No
              </Button>
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <Label htmlFor="comments" className="text-sm font-medium">
              Additional Comments
            </Label>
            <Textarea
              id="comments"
              placeholder="Share your thoughts or suggestions..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Skip
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

FeedbackPopup.displayName = 'FeedbackPopup';
