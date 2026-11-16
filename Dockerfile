FROM oven/bun:1.4.4-slim@sha256:1846adf22496bd711036aae8be147e57bdebbaea2e5264e3e0b5af1db187d9a4 AS dependencies
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.4-slim@sha256:1846adf22496bd711036aae8be147e57bdebbaea2e5264e3e0b5af1db187d9a4 AS runtime
USER root
RUN apt-get update \
    && apt-get install --yes --no-install-recommends gosu \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=dependencies --chown=bun:bun /app/node_modules ./node_modules
COPY --chown=bun:bun package.json gor_network.ts command_registry.ts storage_path.ts community_ui.ts auto_setup.ts setup_journal.ts setup_permissions.ts setup_native.ts server_blueprint.ts server_content.ts ./
COPY --chown=bun:bun feature_base.ts legal_config.ts commands_v44.ts community_state.ts community_actions.ts retention.ts backup_remote.ts change_plan.ts update44.ts ./
COPY --chown=bun:bun restore_backup.ts access_review.ts setup_controls.ts ./
COPY --chmod=755 scripts/docker-entrypoint.sh /usr/local/bin/gor-entrypoint
ENV NODE_ENV=production GOR_DATA_DIR=/data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD bun -e 'const r=await fetch("http://127.0.0.1:"+(process.env.PORT||8080)+"/health");process.exit(r.ok?0:1)'
ENTRYPOINT ["/usr/local/bin/gor-entrypoint"]
CMD ["bun", "run", "gor_network.ts"]
