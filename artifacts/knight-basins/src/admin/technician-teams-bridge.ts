/**
 * TEMPORARY bridge for the technician-team API.
 * Replace this file with generated API hooks in the real task 24.
 */
export type TechnicianTeam = {
  id: number;
  code: string;
  name: string;
  shortName: string;
  aliases: string[];
  sortOrder: number;
  active: boolean;
};

export type CreateAdminTechnicianTeamInput = {
  data: Omit<TechnicianTeam, "id">;
};

export type UpdateAdminTechnicianTeamInput = {
  id: number;
  data: Partial<Omit<TechnicianTeam, "id">>;
};

type TechnicianTeamMutationOptions = {
  onError?: (error: Error) => void;
  onSuccess?: (team: TechnicianTeam) => void;
};

export function useListAdminTechnicianTeams(_params?: { includeInactive?: 1 }, _options?: unknown) {
  return {
    data: [] as TechnicianTeam[],
    isLoading: false,
    isError: false,
  };
}

export function useCreateAdminTechnicianTeam() {
  return {
    mutate: (_variables: CreateAdminTechnicianTeamInput, options?: TechnicianTeamMutationOptions) => {
      options?.onError?.(new Error("API ยังไม่พร้อมใช้งาน"));
    },
    isPending: false,
  };
}

export function useUpdateAdminTechnicianTeam() {
  return {
    mutate: (_variables: UpdateAdminTechnicianTeamInput, options?: TechnicianTeamMutationOptions) => {
      options?.onError?.(new Error("API ยังไม่พร้อมใช้งาน"));
    },
    isPending: false,
  };
}