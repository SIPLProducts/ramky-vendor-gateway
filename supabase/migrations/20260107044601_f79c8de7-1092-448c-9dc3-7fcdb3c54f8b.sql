-- Create vendor_feedback table for collecting vendor experience ratings
CREATE TABLE public.vendor_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendors(id),
  user_id UUID,
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  ease_of_use_rating INTEGER CHECK (ease_of_use_rating >= 1 AND ease_of_use_rating <= 5),
  support_rating INTEGER CHECK (support_rating >= 1 AND support_rating <= 5),
  comments TEXT,
  would_recommend BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_feedback ENABLE ROW LEVEL SECURITY;

-- Allow vendors to insert their own feedback
CREATE POLICY "Vendors can submit feedback" ON public.vendor_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow vendors to view their own feedback
CREATE POLICY "Vendors can view own feedback" ON public.vendor_feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Allow admins to view all feedback
CREATE POLICY "Admins can view all feedback" ON public.vendor_feedback
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow finance and purchase to view feedback
CREATE POLICY "Finance and Purchase can view feedback" ON public.vendor_feedback
  FOR SELECT USING (has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'purchase'::app_role));