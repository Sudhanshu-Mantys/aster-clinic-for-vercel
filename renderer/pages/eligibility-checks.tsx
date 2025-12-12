import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { MantysEligibilityForm } from "../components/MantysEligibilityForm";
import { EligibilityHistoryList } from "../components/EligibilityHistoryList";
import { DashboardHeader } from "../components/DashboardHeader";
import { ProfileTab } from "../components/ProfileTab";

export default function EligibilityChecksPage() {
  const { user, logout, isLoading, teams, switchTeam } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [showTeamList, setShowTeamList] = useState(false);
  const [isSwitchingTeam, setIsSwitchingTeam] = useState(false);

  React.useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleSwitchTeam = async (teamId: string) => {
    setIsSwitchingTeam(true);
    try {
      await switchTeam(teamId);
      setShowTeamList(false);
      router.reload();
    } catch (error) {
      console.error("Failed to switch team:", error);
    } finally {
      setIsSwitchingTeam(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <React.Fragment>
      <Head>
        <title>Eligibility Checks - Aster Clinics</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <DashboardHeader
          user={user}
          onLogout={logout}
          onShowProfile={() => setShowProfile(true)}
        />

        <main className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Eligibility Checks
            </h1>
            <p className="text-gray-600 mt-2">
              Check insurance eligibility and view history of all checks
            </p>
          </div>

          <Tabs defaultValue="new-check" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2 bg-gray-100 border border-gray-200">
              <TabsTrigger value="new-check" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:font-semibold">New Check</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:font-semibold">History</TabsTrigger>
            </TabsList>

            <TabsContent value="new-check" className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Create New Eligibility Check
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Enter patient details to check insurance eligibility.
                    Multiple checks can run simultaneously.
                  </p>
                </div>
                <MantysEligibilityForm
                  patientData={null}
                  insuranceData={null}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Pro Tip: Parallel Processing
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        You can run multiple eligibility checks at the same
                        time! Submit a check, then immediately start another
                        one. All checks will be tracked in the History tab where
                        you can monitor their progress.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <EligibilityHistoryList
                  key={refreshKey}
                  onRefresh={handleRefresh}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Real-Time Updates
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    Live Screenshots
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Multi-Processing
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    Parallel Checks
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-8 w-8 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Full History
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    All Searches
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Profile Modal */}
        {showProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Profile Settings</h2>
                <button
                  onClick={() => setShowProfile(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <ProfileTab
                  user={user}
                  teams={teams}
                  showTeamList={showTeamList}
                  isSwitchingTeam={isSwitchingTeam}
                  onToggleTeamList={() => setShowTeamList(!showTeamList)}
                  onSwitchTeam={handleSwitchTeam}
                  onLogout={logout}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}
