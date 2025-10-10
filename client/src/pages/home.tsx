import { useEffect } from "react";
import { useLocation } from "wouter";
import { isAuthenticated, getUserRole } from "@/lib/auth";

export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/login");
      return;
    }

    const role = getUserRole();
    if (role === "Admin") {
      setLocation("/agency");
    } else if (role === "Client") {
      setLocation("/client");
    } else if (role === "Staff") {
      setLocation("/staff");
    } else {
      setLocation("/login");
    }
  }, [setLocation]);

  return null;
}
