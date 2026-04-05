-- =============================================================================
-- Urban Green Backend — esquema completo para Supabase (PostgreSQL)
-- Ejecutar en: Supabase → SQL Editor → Run (todo de una vez o por bloques)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) USUARIOS — registro email/contraseña + verificación (routes/auth.js)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 2) DISPOSITIVOS IoT — routes/devices.js
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.devices (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_created_at ON public.devices (created_at DESC);

-- -----------------------------------------------------------------------------
-- 3) DATOS DE SENSOR — routes/sensorData.js (device_id → devices.id)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sensor_data (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL REFERENCES public.devices (id) ON DELETE CASCADE,
  temperature NUMERIC,
  humidity NUMERIC NOT NULL,
  soil_moisture NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_data_device_id ON public.sensor_data (device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_created_at ON public.sensor_data (created_at DESC);

-- -----------------------------------------------------------------------------
-- 4) Premium, push y facturación (routes/billing.js, notifications, jobs/plantMonitor)
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;

ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expo_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, expo_token)
);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON public.user_push_tokens(user_id);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_events_user_id ON public.billing_events(user_id);

-- =============================================================================
-- Notas:
-- - Si devices/sensor_data ya existían, CREATE IF NOT EXISTS no las rompe.
-- - La app móvil de favoritos/plantas guardadas usa otro API en el proyecto
--   embebido (server/index.js con SQLite); este repo no expone saved_plants en PG.
-- - El árbol `src/` (SQLite) es legado; la API principal usa `app.js` en la raíz.
-- =============================================================================
