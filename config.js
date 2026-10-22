/* =========================================================
   Climat Elec — Configuration Supabase (V3)
   Deux environnements : development (base de test) et
   production (base existante).
   Les clés "anon / publishable" sont des clés PUBLIQUES :
   elles peuvent être embarquées dans le frontend. Les accès
   sont verrouillés côté serveur par les RLS (Row Level
   Security) définies dans supabase/schema.sql.
   N'exposez JAMAIS la clé "service_role" ici.
   ========================================================= */
window.SUPABASE_ENVS = {
  production: {
    url: "https://gegsynegpfacgwgwxivs.supabase.co",
    anonKey: "sb_publishable_0xxc_225aBiabtdd2tp5Zg_4J9hZH1T",
  },
  development: {
    // Projet Supabase de test : créez un second projet sur
    // https://supabase.com/dashboard puis insérez ici son URL
    // et sa clé publishable (voir supabase/DEPLOYMENT.md §3).
    url: "https://savraokgxykcgpddzrib.supabase.co",
    anonKey: "sb_publishable_ExSWfC3d33s0nd3vpni0OA_jTEbd5IN",
  },
};

/* Sélection de l'environnement :
   1. Paramètre d'URL ?env=development / ?env=production (test ponctuel) ;
   2. Choix persistant via localStorage : localStorage.setItem("supabaseEnv", "development") ;
   3. Sinon : localhost / 127.0.0.1 / fichier ouvert (file://) → development,
      tout le reste (site déployé) → production. */
(function selectSupabaseEnv() {
  var env = null;
  try {
    var param = new URLSearchParams(location.search).get("env");
    if (param && window.SUPABASE_ENVS[param]) env = param;
    else {
      var stored = localStorage.getItem("supabaseEnv");
      if (stored && window.SUPABASE_ENVS[stored]) env = stored;
    }
  } catch (e) { /* localStorage / URLSearchParams indisponible : on ignore */ }

  if (!env) {
    var host = location.hostname;
    var isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
    env = isLocal ? "development" : "production";
  }

  var resolved = window.SUPABASE_ENVS[env];
  if (!resolved || !resolved.url) {
    console.warn(
      "Supabase [" + env + "] non configuré : renseignez url/anonKey dans config.js. " +
      "Pour tester la base de production depuis localhost : ?env=production"
    );
  }

  window.SUPABASE_CONFIG = {
    env: env,
    url: (resolved && resolved.url) || "",
    anonKey: (resolved && resolved.anonKey) || "",
  };
  console.info("Supabase [" + env + "] : " + (window.SUPABASE_CONFIG.url || "non configuré"));
})();
