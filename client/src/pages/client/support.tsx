import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpCircle, Mail, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Support() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-support">Support</h1>
        <p className="text-muted-foreground mt-1">Get help and contact our team</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-contact-email">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Support
            </CardTitle>
            <CardDescription>Get a response within 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Send us an email and we'll get back to you as soon as possible
            </p>
            <Button variant="outline" className="w-full" data-testid="button-email-support">
              <Mail className="h-4 w-4 mr-2" />
              support@agency.com
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-contact-phone">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Phone Support
            </CardTitle>
            <CardDescription>Available Mon-Fri, 9am-5pm EST</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Speak directly with a support representative
            </p>
            <Button variant="outline" className="w-full" data-testid="button-phone-support">
              <Phone className="h-4 w-4 mr-2" />
              1-800-123-4567
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-faq">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Frequently Asked Questions
          </CardTitle>
          <CardDescription>Find answers to common questions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">How do I update my payment method?</h4>
            <p className="text-sm text-muted-foreground">
              Contact your account manager or email support to update your payment details.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">How can I view my project progress?</h4>
            <p className="text-sm text-muted-foreground">
              Navigate to the Projects page to see all active and completed projects with their current status.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Where can I find my invoices?</h4>
            <p className="text-sm text-muted-foreground">
              All your invoices are available on the Billing page, including payment status and due dates.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
