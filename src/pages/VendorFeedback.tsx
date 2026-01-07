import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  Send, 
  CheckCircle2,
  Smile,
  Meh,
  Frown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackData {
  overallRating: number;
  easeOfUseRating: number;
  supportRating: number;
  comments: string;
  wouldRecommend: boolean | null;
}

const StarRating = ({ 
  value, 
  onChange, 
  label 
}: { 
  value: number; 
  onChange: (value: number) => void; 
  label: string;
}) => {
  const [hoverValue, setHoverValue] = useState(0);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="p-1 transition-transform hover:scale-110"
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(0)}
            onClick={() => onChange(star)}
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                (hoverValue || value) >= star
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              )}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Poor</span>
        <span>Excellent</span>
      </div>
    </div>
  );
};

const RatingEmoji = ({ rating }: { rating: number }) => {
  if (rating >= 4) return <Smile className="h-6 w-6 text-success" />;
  if (rating >= 3) return <Meh className="h-6 w-6 text-warning" />;
  if (rating >= 1) return <Frown className="h-6 w-6 text-destructive" />;
  return null;
};

export default function VendorFeedback() {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData>({
    overallRating: 0,
    easeOfUseRating: 0,
    supportRating: 0,
    comments: '',
    wouldRecommend: null,
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: FeedbackData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('vendor_feedback').insert({
        user_id: user?.id || null,
        overall_rating: data.overallRating,
        ease_of_use_rating: data.easeOfUseRating || null,
        support_rating: data.supportRating || null,
        comments: data.comments || null,
        would_recommend: data.wouldRecommend,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: 'Thank You!',
        description: 'Your feedback has been submitted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Submission Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (feedback.overallRating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please provide an overall rating before submitting.',
        variant: 'destructive',
      });
      return;
    }

    submitFeedbackMutation.mutate(feedback);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader />
        <main className="container max-w-lg py-16">
          <Card>
            <CardContent className="pt-12 pb-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 mb-6">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Thank You for Your Feedback!</h2>
              <p className="text-muted-foreground mb-6">
                Your feedback helps us improve our vendor portal experience.
              </p>
              <Button onClick={() => window.location.href = '/'}>
                Return to Home
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <main className="container max-w-2xl py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Share Your Experience</h1>
          <p className="text-muted-foreground">
            Help us improve by rating your experience with the vendor portal
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vendor Portal Feedback</CardTitle>
            <CardDescription>
              Your feedback is valuable to us and will be used to enhance our services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Overall Rating */}
              <div className="p-6 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <StarRating
                    label="Overall Experience *"
                    value={feedback.overallRating}
                    onChange={(value) => setFeedback((prev) => ({ ...prev, overallRating: value }))}
                  />
                  <RatingEmoji rating={feedback.overallRating} />
                </div>
              </div>

              {/* Specific Ratings */}
              <div className="grid gap-6 sm:grid-cols-2">
                <StarRating
                  label="Ease of Use"
                  value={feedback.easeOfUseRating}
                  onChange={(value) => setFeedback((prev) => ({ ...prev, easeOfUseRating: value }))}
                />
                <StarRating
                  label="Support & Documentation"
                  value={feedback.supportRating}
                  onChange={(value) => setFeedback((prev) => ({ ...prev, supportRating: value }))}
                />
              </div>

              {/* Would Recommend */}
              <div className="space-y-3">
                <Label>Would you recommend our vendor portal to others?</Label>
                <RadioGroup
                  value={feedback.wouldRecommend === null ? '' : feedback.wouldRecommend ? 'yes' : 'no'}
                  onValueChange={(value) => 
                    setFeedback((prev) => ({ ...prev, wouldRecommend: value === 'yes' }))
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="recommend-yes" />
                    <Label htmlFor="recommend-yes" className="flex items-center gap-2 cursor-pointer">
                      <ThumbsUp className="h-4 w-4 text-success" />
                      Yes, definitely
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="recommend-no" />
                    <Label htmlFor="recommend-no" className="flex items-center gap-2 cursor-pointer">
                      <ThumbsDown className="h-4 w-4 text-destructive" />
                      Not really
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Comments */}
              <div className="space-y-2">
                <Label htmlFor="comments">Additional Comments (Optional)</Label>
                <Textarea
                  id="comments"
                  placeholder="Tell us what you liked or what we could improve..."
                  rows={4}
                  value={feedback.comments}
                  onChange={(e) => setFeedback((prev) => ({ ...prev, comments: e.target.value }))}
                />
              </div>

              {/* Submit */}
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={submitFeedbackMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
