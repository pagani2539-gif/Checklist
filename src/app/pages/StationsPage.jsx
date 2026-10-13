export function createStationsPage(runtime) {
  const {
    Button,
    CustomSelect,
    EmptyState,
    Icon,
    PageHeader,
    StatusBadge,
    formatDateTime,
    getActivePhysicalEquipment,
    getStationFormatDefinition,
    getStationReadiness,
    useMemo,
    useState,
  } = runtime;

  return function StationsPage({ state }) {
    const profiles = Array.isArray(state.stationProfiles) ? state.stationProfiles : [];
    const provinces = Array.isArray(state.referenceData?.provinces) ? state.referenceData.provinces : [];
    const [query, setQuery] = useState("");
    const [provinceFilter, setProvinceFilter] = useState("all");
    const [readinessFilter, setReadinessFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("active");
    const [sortBy, setSortBy] = useState("code");
    const [pageSize, setPageSize] = useState(10);
    const [page, setPage] = useState(1);
    const changeFilter = (setter, value) => { setter(value); setPage(1); };

    const rows = useMemo(() => profiles.map((profile) => {
      const rounds = (state.inspectionRounds || []).filter((round) => round.stationId === profile.id);
      const readiness = getStationReadiness(profile);
      const latest = rounds.slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
      const province = provinces.find((entry) => entry.id === profile.provinceId);
      const provinceName = profile.province || province?.name || "ไม่ระบุจังหวัด";
      return {
        profile,
        rounds,
        latest,
        provinceName,
        isReady: profile.active !== false && readiness.ready && Boolean(profile.readinessConfirmedAt),
        readiness,
        readinessNote: profile.active === false ? "" : readiness.blockers[0]?.message || (!profile.readinessConfirmedAt ? "ยังไม่ได้ยืนยันความพร้อมใน Workspace" : ""),
        activeEquipment: getActivePhysicalEquipment(profile.equipment).length,
      };
    }), [profiles, provinces, state]);

    const filteredRows = useMemo(() => {
      const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
      const provinceNameForFilter = provinces.find((entry) => entry.id === provinceFilter)?.name;
      const filtered = rows.filter((row) => {
        const { profile, provinceName, isReady } = row;
        const matchesQuery = !normalizedQuery || [
          profile.stationCode,
          profile.stationName,
          provinceName,
        ].filter(Boolean).some((value) => String(value).toLocaleLowerCase("th-TH").includes(normalizedQuery));
        const matchesProvince = provinceFilter === "all" || profile.provinceId === provinceFilter || provinceName === provinceNameForFilter;
        const matchesReadiness = readinessFilter === "all" || (readinessFilter === "ready" ? isReady : !isReady);
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? profile.active !== false : profile.active === false);
        return matchesQuery && matchesProvince && matchesReadiness && matchesStatus;
      });
      return filtered.sort((a, b) => {
        if (sortBy === "province") return a.provinceName.localeCompare(b.provinceName, "th") || a.profile.stationCode.localeCompare(b.profile.stationCode, "th", { numeric: true });
        if (sortBy === "updated") {
          const timeDifference = new Date(b.latest?.updatedAt || 0).getTime() - new Date(a.latest?.updatedAt || 0).getTime();
          if (timeDifference) return timeDifference;
        }
        return a.profile.stationCode.localeCompare(b.profile.stationCode, "th", { numeric: true });
      });
    }, [provinceFilter, provinces, query, readinessFilter, rows, sortBy, statusFilter]);

    const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const firstRow = (currentPage - 1) * pageSize;
    const visibleRows = filteredRows.slice(firstRow, firstRow + pageSize);

    const resetFilters = () => {
      setPage(1);
      setQuery("");
      setProvinceFilter("all");
      setReadinessFilter("all");
      setStatusFilter("active");
    };

    return <section className="ops-page">
      <PageHeader
        eyebrow="STATION REGISTER"
        title="ทะเบียนสถานี"
        description="จัดการข้อมูลแม่ของสถานี อุปกรณ์ Lane และความพร้อมสำหรับรอบการตรวจถัดไป"
        actions={<div className="ops-page-actions"><Button href="#/stations/new" variant="primary" icon="plus">สร้างสถานี</Button></div>}
      />
      <section className="ops-panel station-directory" aria-labelledby="station-directory-title">
        <div className="ops-panel-heading">
          <div>
            <p className="ops-eyebrow">STATION DIRECTORY</p>
            <h3 id="station-directory-title">รายการสถานี</h3>
            <span className="ops-heading-note">ทะเบียนสถานีแสดงข้อมูลประจำสถานี ส่วนหน้าปกและข้อมูลสัญญาแสดงแยกตามรอบงาน</span>
          </div>
          <span className="ops-count-badge" aria-label={`พบ ${filteredRows.length} สถานี`}>{filteredRows.length}</span>
        </div>
        <div className="ops-filter-bar station-directory-filters" aria-label="ตัวกรองทะเบียนสถานี">
          <label className="ops-search"><Icon name="search" /><span className="sr-only">ค้นหารหัส ชื่อสถานี หรือจังหวัด</span><input aria-label="ค้นหารหัส ชื่อสถานี หรือจังหวัด" value={query} onChange={(event) => changeFilter(setQuery, event.target.value)} placeholder="ค้นหารหัส ชื่อสถานี หรือจังหวัด..." />{query && <Button icon="close" iconOnly className="ops-search-clear" onClick={(event) => { event.preventDefault(); changeFilter(setQuery, ""); }}>ล้างคำค้น</Button>}</label>
          <label className="ops-field ops-filter-select"><span>จังหวัด</span><CustomSelect value={provinceFilter} onChange={(event) => changeFilter(setProvinceFilter, event.target.value)}><option value="all">ทุกจังหวัด</option>{provinces.filter((province) => province.active !== false).map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}</CustomSelect></label>
          <label className="ops-field ops-filter-select"><span>ความพร้อม</span><CustomSelect value={readinessFilter} onChange={(event) => changeFilter(setReadinessFilter, event.target.value)}><option value="all">ทุกสถานะ</option><option value="ready">พร้อมใช้งาน</option><option value="blocked">ต้องแก้ไข</option></CustomSelect></label>
          <label className="ops-field ops-filter-select"><span>สถานะ</span><CustomSelect value={statusFilter} onChange={(event) => changeFilter(setStatusFilter, event.target.value)}><option value="active">ใช้งาน</option><option value="inactive">ปิดใช้งาน</option><option value="all">ทั้งหมด</option></CustomSelect></label>
          <label className="ops-field ops-filter-select"><span>เรียงตาม</span><CustomSelect value={sortBy} onChange={(event) => changeFilter(setSortBy, event.target.value)}><option value="code">รหัสสถานี</option><option value="province">จังหวัด</option><option value="updated">แก้ไขล่าสุด</option></CustomSelect></label>
          <Button onClick={resetFilters} variant="secondary" icon="refresh">คืนค่าตัวกรอง</Button>
        </div>
        {(query.trim() || provinceFilter !== "all" || readinessFilter !== "all" || statusFilter !== "active") && <div className="station-directory-active-filters" role="group" aria-label="ตัวกรองที่เลือกอยู่"><span>กำลังกรอง:</span>
          {query.trim() && <button type="button" onClick={() => changeFilter(setQuery, "")} aria-label="ล้างคำค้น">คำค้น: {query.trim()} <span aria-hidden="true">×</span></button>}
          {provinceFilter !== "all" && <button type="button" onClick={() => changeFilter(setProvinceFilter, "all")} aria-label="ล้างตัวกรองจังหวัด">จังหวัด: {provinces.find((entry) => entry.id === provinceFilter)?.name || "ที่เลือก"} <span aria-hidden="true">×</span></button>}
          {readinessFilter !== "all" && <button type="button" onClick={() => changeFilter(setReadinessFilter, "all")} aria-label="ล้างตัวกรองความพร้อม">ความพร้อม: {readinessFilter === "ready" ? "พร้อมใช้งาน" : "ต้องแก้ไข"} <span aria-hidden="true">×</span></button>}
          {statusFilter !== "active" && <button type="button" onClick={() => changeFilter(setStatusFilter, "active")} aria-label="คืนสถานะเริ่มต้น">สถานะ: {statusFilter === "inactive" ? "ปิดใช้งาน" : "ทั้งหมด"} <span aria-hidden="true">×</span></button>}
        </div>}
        {filteredRows.length ? <div className="ops-station-directory-list">{visibleRows.map((row) => {
          const { profile, rounds, latest, activeEquipment, isReady, provinceName, readinessNote, readiness } = row;
          const archived = profile.active === false;
          const workspaceHref = `#/stations/${encodeURIComponent(profile.id)}`;
          return <article className={`ops-station-directory-row ${archived ? "is-archived" : ""}`} key={profile.id}>
            <div className="ops-station-directory-main">

              <div>
                <div className="ops-round-meta"><span className="ops-station-directory-icon"><Icon name={archived ? "archive" : "building"} /></span><span className="ops-round-code">{profile.stationCode}</span><span className="ops-station-format-badge">{getStationFormatDefinition(profile.stationFormat).shortLabel}</span><StatusBadge status={archived ? "inactive" : "normal"}>{archived ? "ปิดใช้งาน" : "ใช้งาน"}</StatusBadge></div>
                <h3>{profile.stationName}</h3>
                <div className="ops-station-directory-meta-grid">
                  <span><strong>จังหวัด</strong>{provinceName}</span>
                  <span><strong>ความพร้อม</strong><StatusBadge status={archived ? "inactive" : isReady ? "normal" : "waiting"}>{archived ? "สถานีปิดใช้งาน" : isReady ? "พร้อมใช้งาน" : "ต้องแก้ไข"}</StatusBadge>{readinessNote && <small className="station-directory-readiness-note">{readinessNote}{readiness.blockers.length > 1 ? ` · อีก ${readiness.blockers.length - 1} รายการ` : ""}</small>}</span>
                  <span><strong>ข้อมูลปัจจุบัน</strong>{activeEquipment} อุปกรณ์ · {profile.lanes?.filter((lane) => lane.active !== false).length || 0} Lane</span>
                  <span><strong>รอบล่าสุด</strong>{latest ? formatDateTime(latest.updatedAt) : "ยังไม่มีรอบ"}</span>
                </div>
                <p>{rounds.filter((round) => round.status === "draft").length} รอบกำลังกรอก · {rounds.filter((round) => round.status === "closed").length} ประวัติปิดแล้ว</p>
              </div>
            </div>
            <div className="ops-station-directory-actions">
              {isReady && <Button href={`#/inspections/new?stationId=${encodeURIComponent(profile.id)}`} variant="primary" icon="refresh">เริ่มรอบตรวจ</Button>}
              <Button href={workspaceHref} variant={isReady ? "secondary" : "primary"} icon="arrow">{readinessNote ? "แก้ความพร้อม" : "เปิด Workspace"}</Button>
            </div>
          </article>;
        })}</div> : <EmptyState icon="search" title="ไม่พบสถานีตามตัวกรอง" action={<Button onClick={resetFilters} variant="secondary" icon="refresh">คืนค่าตัวกรอง</Button>}>ลองเปลี่ยนคำค้น จังหวัด ความพร้อม หรือสถานะ</EmptyState>}
        <nav className="station-directory-pagination" aria-label="แบ่งหน้ารายการสถานี">
          <span role="status">พบ {filteredRows.length} สถานี · แสดง {filteredRows.length ? firstRow + 1 : 0}–{Math.min(firstRow + pageSize, filteredRows.length)}</span>
          <label className="ops-field"><span>สถานีต่อหน้า</span><CustomSelect value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 20, 50].map((size) => <option key={size} value={String(size)}>{size} สถานี</option>)}</CustomSelect></label>
          <div className="station-directory-pagination-actions">
            <Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>หน้าก่อนหน้า</Button>
            <span>หน้า {currentPage} / {pageCount}</span>
            <Button variant="secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>หน้าถัดไป</Button>
          </div>
        </nav>
      </section>
    </section>;
  };
}
