import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "./ui/button";

interface DashboardHeaderProps {
  user: {
    display_name?: string;
    primary_email: string;
    selected_team?: {
      display_name: string;
    };
  };
  onLogout: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  onLogout,
}) => {
  const router = useRouter();

  const navItems = [
    { name: "Lifetrenz Integration", path: "/dashboard" },
    { name: "Eligibility Checks", path: "/eligibility-checks" },
  ];

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-4">
              <Image src="/images/logo.png" alt="Logo" width={40} height={40} />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Aster Clinics
                </h1>
                {user.selected_team && (
                  <p className="text-sm text-gray-500">
                    {user.selected_team.display_name}
                  </p>
                )}
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="hidden md:flex space-x-4">
              {navItems.map((item) => {
                const isActive = router.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user.display_name || user.primary_email}
              </p>
              <p className="text-xs text-gray-500">{user.primary_email}</p>
            </div>
            <Button onClick={onLogout} variant="outline" size="sm">
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
