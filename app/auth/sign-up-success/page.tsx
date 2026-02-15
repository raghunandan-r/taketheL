import Link from "next/link"
import { Train } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SignUpSuccessPage() {
  return (
    <div className="flex flex-col min-h-screen max-w-[390px] w-full mx-auto px-4 pt-24 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mx-auto mb-6">
        <Train className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-xl font-semibold text-foreground mb-2">
        Check your email
      </h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-[280px] mx-auto">
        We&apos;ve sent you a confirmation link. Click it to activate your
        account and start connecting with L-train commuters.
      </p>
      <Button asChild>
        <Link href="/auth/login">Back to sign in</Link>
      </Button>
    </div>
  )
}
