export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activities: {
        Row: {
          active_s: number;
          created_at: string;
          distance_m: number;
          ended_at: string | null;
          id: string;
          last_push_at: string | null;
          points: number;
          started_at: string;
          status: Database["public"]["Enums"]["activity_status"];
          steps: number;
          type: Database["public"]["Enums"]["activity_type"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          active_s?: number;
          created_at?: string;
          distance_m?: number;
          ended_at?: string | null;
          id?: string;
          last_push_at?: string | null;
          points?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["activity_status"];
          steps?: number;
          type: Database["public"]["Enums"]["activity_type"];
          user_id: string;
        };
        Update: {
          active_s?: number;
          created_at?: string;
          distance_m?: number;
          ended_at?: string | null;
          id?: string;
          last_push_at?: string | null;
          points?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["activity_status"];
          steps?: number;
          type?: Database["public"]["Enums"]["activity_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_points: {
        Row: {
          accuracy_m: number | null;
          activity_id: string;
          lat: number;
          lng: number;
          recorded_at: string;
          seq: number;
        };
        ComputedFields: never;
        Insert: {
          accuracy_m?: number | null;
          activity_id: string;
          lat: number;
          lng: number;
          recorded_at: string;
          seq: number;
        };
        Update: {
          accuracy_m?: number | null;
          activity_id?: string;
          lat?: number;
          lng?: number;
          recorded_at?: string;
          seq?: number;
        };
        Relationships: [
          {
            foreignKeyName: "activity_points_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
        ];
      };
      badges: {
        Row: {
          description: string;
          icon_key: string;
          id: string;
          name: string;
          sort: number;
        };
        ComputedFields: never;
        Insert: {
          description: string;
          icon_key: string;
          id: string;
          name: string;
          sort?: number;
        };
        Update: {
          description?: string;
          icon_key?: string;
          id?: string;
          name?: string;
          sort?: number;
        };
        Relationships: [];
      };
      challenge_completions: {
        Row: {
          challenge_id: string;
          completed_at: string;
          department_id: string | null;
          id: number;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          challenge_id: string;
          completed_at?: string;
          department_id?: string | null;
          id?: never;
          user_id?: string | null;
        };
        Update: {
          challenge_id?: string;
          completed_at?: string;
          department_id?: string | null;
          id?: never;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "challenge_completions_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_completions_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_completions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      challenge_members: {
        Row: {
          challenge_id: string;
          joined_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          challenge_id: string;
          joined_at?: string;
          user_id: string;
        };
        Update: {
          challenge_id?: string;
          joined_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "challenge_members_challenge_id_fkey";
            columns: ["challenge_id"];
            isOneToOne: false;
            referencedRelation: "challenges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "challenge_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      challenges: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"] | null;
          created_at: string;
          description: string;
          ends_at: string;
          id: string;
          metric: Database["public"]["Enums"]["challenge_metric"];
          reward_points: number;
          scope: Database["public"]["Enums"]["challenge_scope"];
          slug: string;
          starts_at: string;
          target: number;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          activity_type?: Database["public"]["Enums"]["activity_type"] | null;
          created_at?: string;
          description?: string;
          ends_at: string;
          id?: string;
          metric: Database["public"]["Enums"]["challenge_metric"];
          reward_points?: number;
          scope?: Database["public"]["Enums"]["challenge_scope"];
          slug: string;
          starts_at: string;
          target: number;
          title: string;
        };
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"] | null;
          created_at?: string;
          description?: string;
          ends_at?: string;
          id?: string;
          metric?: Database["public"]["Enums"]["challenge_metric"];
          reward_points?: number;
          scope?: Database["public"]["Enums"]["challenge_scope"];
          slug?: string;
          starts_at?: string;
          target?: number;
          title?: string;
        };
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          id: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      event_participants: {
        Row: {
          checked_in_at: string | null;
          event_id: string;
          registered_at: string;
          status: Database["public"]["Enums"]["participation_status"];
          user_id: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          checked_in_at?: string | null;
          event_id: string;
          registered_at?: string;
          status?: Database["public"]["Enums"]["participation_status"];
          user_id: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          checked_in_at?: string | null;
          event_id?: string;
          registered_at?: string;
          status?: Database["public"]["Enums"]["participation_status"];
          user_id?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_participants_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      event_secrets: {
        Row: {
          checkin_code: string;
          event_id: string;
        };
        ComputedFields: never;
        Insert: {
          checkin_code?: string;
          event_id: string;
        };
        Update: {
          checkin_code?: string;
          event_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_secrets_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          capacity: number | null;
          created_at: string;
          description: string;
          ends_at: string;
          id: string;
          organiser_id: string | null;
          points: number;
          sport: Database["public"]["Enums"]["event_sport"];
          starts_at: string;
          title: string;
          venue: string;
        };
        ComputedFields: never;
        Insert: {
          capacity?: number | null;
          created_at?: string;
          description?: string;
          ends_at: string;
          id?: string;
          organiser_id?: string | null;
          points?: number;
          sport: Database["public"]["Enums"]["event_sport"];
          starts_at: string;
          title: string;
          venue: string;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          description?: string;
          ends_at?: string;
          id?: string;
          organiser_id?: string | null;
          points?: number;
          sport?: Database["public"]["Enums"]["event_sport"];
          starts_at?: string;
          title?: string;
          venue?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_organiser_id_fkey";
            columns: ["organiser_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      points_ledger: {
        Row: {
          amount: number;
          created_at: string;
          earned_at: string;
          id: number;
          reason: Database["public"]["Enums"]["point_reason"];
          source_key: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          earned_at?: string;
          id?: never;
          reason: Database["public"]["Enums"]["point_reason"];
          source_key: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          earned_at?: string;
          id?: never;
          reason?: Database["public"]["Enums"]["point_reason"];
          source_key?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "points_ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          department_id: string | null;
          display_name: string;
          id: string;
          role: Database["public"]["Enums"]["user_role"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          department_id?: string | null;
          display_name: string;
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Update: {
          created_at?: string;
          department_id?: string | null;
          display_name?: string;
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      redemptions: {
        Row: {
          code: string;
          cost: number;
          created_at: string;
          fulfilled_at: string | null;
          id: string;
          reward_id: string;
          status: Database["public"]["Enums"]["redemption_status"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          code?: string;
          cost: number;
          created_at?: string;
          fulfilled_at?: string | null;
          id?: string;
          reward_id: string;
          status?: Database["public"]["Enums"]["redemption_status"];
          user_id: string;
        };
        Update: {
          code?: string;
          cost?: number;
          created_at?: string;
          fulfilled_at?: string | null;
          id?: string;
          reward_id?: string;
          status?: Database["public"]["Enums"]["redemption_status"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "redemptions_reward_id_fkey";
            columns: ["reward_id"];
            isOneToOne: false;
            referencedRelation: "rewards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "redemptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rewards: {
        Row: {
          active: boolean;
          cost: number;
          created_at: string;
          description: string;
          id: string;
          sort: number;
          stock: number | null;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          cost: number;
          created_at?: string;
          description?: string;
          id?: string;
          sort?: number;
          stock?: number | null;
          title: string;
        };
        Update: {
          active?: boolean;
          cost?: number;
          created_at?: string;
          description?: string;
          id?: string;
          sort?: number;
          stock?: number | null;
          title?: string;
        };
        Relationships: [];
      };
      user_badges: {
        Row: {
          awarded_at: string;
          badge_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          awarded_at?: string;
          badge_id: string;
          user_id: string;
        };
        Update: {
          awarded_at?: string;
          badge_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_badges_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      campus_date: { Args: { ts?: string }; Returns: string };
      campus_day_start: { Args: { d: string }; Returns: string };
      campus_week_start: { Args: { ts?: string }; Returns: string };
      check_in: {
        Args: { p_code: string };
        Returns: {
          event_id: string;
          status: Database["public"]["Enums"]["participation_status"];
          title: string;
        }[];
      };
      current_role_is: {
        Args: { r: Database["public"]["Enums"]["user_role"] };
        Returns: boolean;
      };
      discard_activity: { Args: { p_activity_id: string }; Returns: undefined };
      finish_activity: {
        Args: {
          p_active_s?: number;
          p_activity_id: string;
          p_distance_m?: number;
          p_route?: Json;
          p_steps?: number;
        };
        Returns: Json;
      };
      get_badges: {
        Args: Record<PropertyKey, never>;
        Returns: {
          awarded_at: string;
          description: string;
          earned: boolean;
          icon_key: string;
          id: string;
          name: string;
        }[];
      };
      get_challenges: {
        Args: Record<PropertyKey, never>;
        Returns: {
          activity_type: Database["public"]["Enums"]["activity_type"];
          completed: boolean;
          completed_at: string;
          description: string;
          ends_at: string;
          id: string;
          joined: boolean;
          joined_at: string;
          member_count: number;
          metric: Database["public"]["Enums"]["challenge_metric"];
          my_contribution: number;
          progress: number;
          progress_ratio: number;
          reward_points: number;
          scope: Database["public"]["Enums"]["challenge_scope"];
          slug: string;
          starts_at: string;
          target: number;
          title: string;
        }[];
      };
      get_department_leaderboard: {
        Args: { p_period?: Database["public"]["Enums"]["leaderboard_period"] };
        Returns: {
          active_members: number;
          avg_points: number;
          department_id: string;
          is_mine: boolean;
          members: number;
          name: string;
          participation_pct: number;
          rank: number;
          total_points: number;
        }[];
      };
      get_event_checkin: {
        Args: { p_event_id: string };
        Returns: {
          code: string;
          event_id: string;
          qr_payload: string;
        }[];
      };
      get_event_participants: {
        Args: { p_event_id: string };
        Returns: {
          checked_in_at: string;
          department_id: string;
          display_name: string;
          registered_at: string;
          status: Database["public"]["Enums"]["participation_status"];
          user_id: string;
          verified_at: string;
        }[];
      };
      get_events: {
        Args: Record<PropertyKey, never>;
        Returns: {
          can_manage: boolean;
          capacity: number;
          checked_in_count: number;
          description: string;
          ends_at: string;
          id: string;
          my_status: Database["public"]["Enums"]["participation_status"];
          organiser_id: string;
          organiser_name: string;
          participant_count: number;
          points: number;
          sport: Database["public"]["Enums"]["event_sport"];
          starts_at: string;
          title: string;
          venue: string;
        }[];
      };
      get_everest: {
        Args: Record<PropertyKey, never>;
        Returns: {
          current_steps: number;
          progress_ratio: number;
          steps_to_next_summit: number;
          summit_count: number;
          target_steps: number;
          week_start: string;
        }[];
      };
      get_home: { Args: Record<PropertyKey, never>; Returns: Json };
      get_individual_leaderboard: {
        Args: {
          p_department_id?: string;
          p_limit?: number;
          p_period?: Database["public"]["Enums"]["leaderboard_period"];
        };
        Returns: {
          department_id: string;
          department_name: string;
          display_name: string;
          is_me: boolean;
          points: number;
          rank: number;
          user_id: string;
        }[];
      };
      join_challenge: { Args: { p_challenge_id: string }; Returns: Json };
      leave_challenge: { Args: { p_challenge_id: string }; Returns: undefined };
      push_activity: {
        Args: {
          p_active_s?: number;
          p_activity_id: string;
          p_distance_m?: number;
          p_route?: Json;
          p_steps?: number;
        };
        Returns: {
          active_s: number;
          created_at: string;
          distance_m: number;
          ended_at: string | null;
          id: string;
          last_push_at: string | null;
          points: number;
          started_at: string;
          status: Database["public"]["Enums"]["activity_status"];
          steps: number;
          type: Database["public"]["Enums"]["activity_type"];
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "activities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      redeem_reward: {
        Args: { p_reward_id: string };
        Returns: {
          code: string;
          cost: number;
          created_at: string;
          fulfilled_at: string | null;
          id: string;
          reward_id: string;
          status: Database["public"]["Enums"]["redemption_status"];
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "redemptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_event: {
        Args: { p_event_id: string };
        Returns: {
          checked_in_at: string | null;
          event_id: string;
          registered_at: string;
          status: Database["public"]["Enums"]["participation_status"];
          user_id: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "event_participants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      start_activity: {
        Args: { p_type: Database["public"]["Enums"]["activity_type"] };
        Returns: {
          active_s: number;
          created_at: string;
          distance_m: number;
          ended_at: string | null;
          id: string;
          last_push_at: string | null;
          points: number;
          started_at: string;
          status: Database["public"]["Enums"]["activity_status"];
          steps: number;
          type: Database["public"]["Enums"]["activity_type"];
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "activities";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      verify_all_checked_in: { Args: { p_event_id: string }; Returns: number };
      verify_participant: {
        Args: { p_approve?: boolean; p_event_id: string; p_user_id: string };
        Returns: {
          checked_in_at: string | null;
          event_id: string;
          registered_at: string;
          status: Database["public"]["Enums"]["participation_status"];
          user_id: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "event_participants";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      activity_status: "live" | "completed" | "discarded";
      activity_type: "walk" | "run" | "cycle";
      challenge_metric:
        | "steps"
        | "distance_m"
        | "active_minutes"
        | "sessions"
        | "points"
        | "verified_events";
      challenge_scope: "individual" | "department" | "campus";
      event_sport: "futsal" | "pickleball" | "badminton" | "other";
      leaderboard_period: "week" | "all";
      participation_status:
        | "registered"
        | "checked_in"
        | "verified"
        | "rejected";
      point_reason:
        | "activity"
        | "daily_active"
        | "streak"
        | "personal_best"
        | "event"
        | "challenge"
        | "team_challenge";
      redemption_status: "pending" | "fulfilled" | "cancelled";
      user_role: "student" | "organiser" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_status: ["live", "completed", "discarded"],
      activity_type: ["walk", "run", "cycle"],
      challenge_metric: [
        "steps",
        "distance_m",
        "active_minutes",
        "sessions",
        "points",
        "verified_events",
      ],
      challenge_scope: ["individual", "department", "campus"],
      event_sport: ["futsal", "pickleball", "badminton", "other"],
      leaderboard_period: ["week", "all"],
      participation_status: [
        "registered",
        "checked_in",
        "verified",
        "rejected",
      ],
      point_reason: [
        "activity",
        "daily_active",
        "streak",
        "personal_best",
        "event",
        "challenge",
        "team_challenge",
      ],
      redemption_status: ["pending", "fulfilled", "cancelled"],
      user_role: ["student", "organiser", "admin"],
    },
  },
} as const;
