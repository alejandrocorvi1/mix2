import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: GET /api/supabase-usage
  app.get('/api/supabase-usage', async (req, res) => {
    try {
      const ref = (req.query.ref as string) || '';
      const token = (req.query.token as string) || '';

      if (!ref || !token) {
        return res.status(400).json({
          success: false,
          error: 'Faltan parámetros requeridos: projectRef (ref) y managementToken (token)'
        });
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'GAIS-TwinLink-App'
      };

      let egressUsageBytes = 0;
      let egressLimitBytes = 5 * 1024 * 1024 * 1024; // 5.0 GB por defecto (plan gratuito)
      let organizationId = '';

      // 1. Consultar información del proyecto
      try {
        const projRes = await fetch(`https://api.supabase.com/v1/projects/${ref}`, { headers });
        if (projRes.ok) {
          const projData = await projRes.json();
          if (projData && projData.organization_id) {
            organizationId = projData.organization_id;
          }
        }
      } catch (e) {
        // Silently handle exception
      }

      // 2. Consultar métricas de uso del proyecto
      let usageData: any = null;
      try {
        const usageRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/usage`, { headers });
        if (usageRes.ok) {
          usageData = await usageRes.json();
        }
      } catch (e) {
        // Silently handle network exceptions
      }

      // 3. Fallback: Consultar uso de la organización si la consulta directa del proyecto no devolvió uso
      if (!usageData && organizationId) {
        try {
          const orgUsageRes = await fetch(`https://api.supabase.com/v1/organizations/${organizationId}/usage`, { headers });
          if (orgUsageRes.ok) {
            usageData = await orgUsageRes.json();
          }
        } catch (e) {
          console.warn('[Supabase API] Exception fetching org usage:', e);
        }
      }

      // 4. Extraer el valor de Egress (ancho de banda)
      if (usageData) {
        // Estructuras comunes en Supabase Management API v1:
        if (typeof usageData.egress_bytes === 'number') {
          egressUsageBytes = usageData.egress_bytes;
        } else if (typeof usageData.total_egress_bytes === 'number') {
          egressUsageBytes = usageData.total_egress_bytes;
        } else if (typeof usageData.egress?.usage === 'number') {
          egressUsageBytes = usageData.egress.usage;
        } else if (typeof usageData.egress?.bytes === 'number') {
          egressUsageBytes = usageData.egress.bytes;
        } else if (typeof usageData.db_egress?.usage === 'number') {
          egressUsageBytes = (usageData.db_egress.usage || 0) + (usageData.storage_egress?.usage || 0);
        } else if (Array.isArray(usageData.metrics)) {
          const egressMetric = usageData.metrics.find((m: any) => 
            m.metric === 'egress' || m.name === 'egress' || m.metric === 'total_egress'
          );
          if (egressMetric) {
            egressUsageBytes = egressMetric.value || egressMetric.usage || 0;
          }
        }

        // Límite de Egress si está especificado en el objeto
        if (typeof usageData.egress_limit_bytes === 'number' && usageData.egress_limit_bytes > 0) {
          egressLimitBytes = usageData.egress_limit_bytes;
        } else if (typeof usageData.egress?.limit === 'number' && usageData.egress.limit > 0) {
          egressLimitBytes = usageData.egress.limit;
        }
      }

      // Calcular porcentajes y valores en GB
      const rawPercentage = (egressUsageBytes / egressLimitBytes) * 100;
      const percentage = parseFloat(rawPercentage.toFixed(2));
      const usedGb = parseFloat((egressUsageBytes / (1024 * 1024 * 1024)).toFixed(2));
      const totalGb = parseFloat((egressLimitBytes / (1024 * 1024 * 1024)).toFixed(2));

      return res.json({
        success: true,
        projectRef: ref,
        percentage,
        usedGb,
        totalGb,
        egressUsageBytes,
        egressLimitBytes
      });
    } catch (err: any) {
      console.error('Error en /api/supabase-usage:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Error interno al consultar métricas de Supabase Management API'
      });
    }
  });

  // Middleware de Vite para desarrollo
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
