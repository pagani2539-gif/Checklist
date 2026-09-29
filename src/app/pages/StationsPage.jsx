export function createStationsPage(runtime) {
  const {
    Button,
    CustomSelect,
    EmptyState,
    Icon,
    PageHeader,
    StatusBadge,
    assignmentsForStation,
    contractFor,
    formatDateTime,
    getActivePhysicalEquipment,
    getStationFormatDefinition,
    getStationReadiness,
    regionsForContract,
    useMemo,
    useState,
    workPackageFor,
    workPackagesForContract,
  } = runtime;

  return function StationsPage({ state }) {
    const profiles = Array.isArray(state.stationProfiles) ? state.stationProfiles : [];
    const contracts = Array.isArray(state.contracts) ? state.contracts : [];
    const regions = Array.isArray(state.regions) ? state.regions : [];
    const provinces = Array.isArray(state.referenceData?.provinces) ? state.referenceData.provinces : [];
    const [query, setQuery] = useState("");
    const [contractFilter, setContractFilter] = useState("all");
    const [workPackageFilter, setWorkPackageFilter] = useState("all");
    const [regionFilter, setRegionFilter] = useState("all");
    const [provinceFilter, setProvinceFilter] = useState("all");
    const [readinessFilter, setReadinessFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("active");

    const workPackages = useMemo(
      () => contractFilter === "all" ? (state.workPackages || []) : workPackagesForContract(state, contractFilter),
      [contractFilter, state],
    );

    const rows = useMemo(() => profiles.map((profile) => {
      const rounds = (state.inspectionRounds || []).filter((round) => round.stationId === profile.id);
      const assignments = assignmentsForStation(state, profile.id).map((assignment) => {
        const contract = contractFor(state, assignment.contractId);
        const workPackage = workPackageFor(state, assignment.workPackageId);
        return { assignment, contract, workPackage, regions: regionsForContract(state, contract) };
      });
      const readiness = getStationReadiness(profile);
      const latest = rounds.slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
      const province = provinces.find((entry) => entry.id === profile.provinceId);
      const provinceName = profile.province || province?.name || "ไม่ระบุจังหวัด";
      return {
        profile,
        rounds,
        assignments,
        latest,
        provinceName,
        isReady: profile.active !== false && readiness.ready && Boolean(profile.readinessConfirmedAt),
        activeEquipment: getActivePhysicalEquipment(profile.equipment).length,
      };
    }), [profiles, provinces, state]);

    const filteredRows = useMemo(() => {
      const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
      const provinceNameForFilter = provinces.find((entry) => entry.id === provinceFilter)?.name;
      return rows.filter((row) => {
        const { profile, assignments, provinceName, isReady } = row;
        const matchesQuery = !normalizedQuery || [
          profile.stationCode,
          profile.stationName,
          provinceName,
          ...assignments.flatMap(({ contract, workPackage }) => [contract?.contractNo, contract?.title, workPackage?.title, workPackage?.packageNo, workPackage?.reportSequence]),
        ].filter(Boolean).some((value) => String(value).toLocaleLowerCase("th-TH").includes(normalizedQuery));
        const matchesContract = contractFilter === "all" || assignments.some(({ contract }) => contract?.id === contractFilter);
        const matchesWorkPackage = workPackageFilter === "all" || assignments.some(({ workPackage }) => workPackage?.id === workPackageFilter);
        const matchesRegion = regionFilter === "all" || assignments.some(({ regions: assignmentRegions }) => assignmentRegions.some((region) => region.id === regionFilter));
        const matchesProvince = provinceFilter === "all" || profile.provinceId === provinceFilter || provinceName === provinceNameForFilter;
        const matchesReadiness = readinessFilter === "all" || (readinessFilter === "ready" ? isReady : !isReady);
        const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? profile.active !== false : profile.active === false);
        return matchesQuery && matchesContract && matchesWorkPackage && matchesRegion && matchesProvince && matchesReadiness && matchesStatus;
      });
    }, [contractFilter, provinceFilter, provinces, query, readinessFilter, regionFilter, rows, statusFilter, workPackageFilter]);

    const resetFilters = () => {
      setQuery("");
      setContractFilter("all");
      setWorkPackageFilter("all");
      setRegionFilter("all");
      setProvinceFilter("all");
      setReadinessFilter("all");
      setStatusFilter("active");
    };

    const onContractFilterChange = (value) => {
      setContractFilter(value);
      setWorkPackageFilter("all");
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
            <span className="ops-heading-note">ข้อมูลสถานีเป็นข้อมูลแม่แยกจากสัญญาเดิม ประวัติและ Snapshot จะไม่ถูกเปลี่ยนตามการแก้ไขปัจจุบัน</span>
          </div>
          <span className="ops-count-badge" aria-label={`พบ ${filteredRows.length} สถานี`}>{filteredRows.length}</span>
        </div>
        <div className="ops-filter-bar station-directory-filters" aria-label="ตัวกรองทะเบียนสถานี">
          <label className="ops-search"><Icon name="search" /><span className="sr-only">ค้นหาสถานี</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหารหัส ชื่อ จังหวัด หรือสัญญา..." /></label>
          <label className="ops-field ops-filter-select"><span>สัญญา</span><CustomSelect value={contractFilter} onChange={(event) => onContractFilterChange(event.target.value)}><option value="all">ทุกสัญญา</option>{contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contractNo} · {contract.title || contract.projectName}</option>)}</CustomSelect></label>
          <label className="ops-field ops-filter-select"><span>งวดงาน</span><CustomSelect value={workPackageFilter} onChange={(event) => setWorkPackageFilter(event.target.value)} disabled={contractFilter === "all"}><option value="all">ทุกงวด</option>{workPackages.map((workPackage) => <option key={workPackage.id} value={workPackage.id}>{workPackage.reportSequence || workPackage.packageNo} · {workPackage.title}</option>)}</CustomSelect></label>
          <label className="ops-field ops-filter-select"><span>ภาค</span><CustomSelect value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}><option value="all">ทุกภาค</option>{regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</CustomSelect></label>
          <label className="ops-field ops-filter-select"><span>จังหวัด</span><CustomSelect value={provinceFilter} onChange={(event) => setProvinceFilter(event.target.value)}><option value="all">ทุกจังหวัด</option>{provinces.filter((province) => province.active !== false).map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}</CustomSelect></label>
          <label className="ops-field ops-filter-select"><span>ความพร้อม</span><CustomSelect value={readinessFilter} onChange={(event) => setReadinessFilter(event.target.value)}><option value="all">ทุกสถานะ</option><option value="ready">พร้อมใช้งาน</option><option value="blocked">ต้องแก้ไข</option></CustomSelect></label>
          <label className="ops-field ops-filter-select"><span>สถานะ</span><CustomSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">ใช้งาน</option><option value="inactive">ปิดใช้งาน</option><option value="all">ทั้งหมด</option></CustomSelect></label>
          <Button onClick={resetFilters} variant="secondary" icon="refresh">ล้างตัวกรอง</Button>
        </div>
        {filteredRows.length ? <div className="ops-station-directory-list">{filteredRows.map((row) => {
          const { profile, rounds, assignments, latest, activeEquipment, isReady, provinceName } = row;
          const archived = profile.active === false;
          const workspaceHref = assignments.length === 1
            ? `#/stations/${encodeURIComponent(profile.id)}?contractId=${encodeURIComponent(assignments[0].assignment.contractId)}&workPackageId=${encodeURIComponent(assignments[0].assignment.workPackageId)}`
            : `#/stations/${encodeURIComponent(profile.id)}`;
          return <article className={`ops-station-directory-row ${archived ? "is-archived" : ""}`} key={profile.id}>
            <div className="ops-station-directory-main">
              <span className="ops-station-directory-icon"><Icon name={archived ? "archive" : "building"} /></span>
              <div>
                <div className="ops-round-meta"><span className="ops-round-code">{profile.stationCode}</span><span className="ops-station-format-badge">{getStationFormatDefinition(profile.stationFormat).shortLabel}</span><StatusBadge status={archived ? "inactive" : "normal"}>{archived ? "ปิดใช้งาน" : "ใช้งาน"}</StatusBadge></div>
                <h3>{profile.stationName}</h3>
                <div className="ops-station-directory-meta-grid">
                  <span><strong>จังหวัด</strong>{provinceName}</span>
                  <span><strong>ความพร้อม</strong><StatusBadge status={isReady ? "normal" : "waiting"}>{isReady ? "พร้อมใช้งาน" : "ต้องแก้ไข"}</StatusBadge></span>
                  <span><strong>ข้อมูลปัจจุบัน</strong>{activeEquipment} อุปกรณ์ · {profile.lanes?.filter((lane) => lane.active !== false).length || 0} Lane</span>
                  <span><strong>รอบล่าสุด</strong>{latest ? formatDateTime(latest.updatedAt) : "ยังไม่มีรอบ"}</span>
                </div>
                <div className="ops-station-assignment-summary" aria-label="บริบทสัญญาของสถานี">
                  <strong>สัญญาที่เกี่ยวข้อง</strong>
                  {assignments.length ? assignments.slice(0, 2).map(({ assignment, contract, workPackage }) => <span key={assignment.id}>{contract?.contractNo || "สัญญา"} · งวด {workPackage?.reportSequence || workPackage?.packageNo || "—"}</span>) : <span>ยังไม่ผูกสัญญา</span>}
                  {assignments.length > 2 && <span>และอีก {assignments.length - 2} รายการ</span>}
                  {assignments.length > 1 && <em>หลายสัญญาที่เชื่อมกับสถานีนี้ · เลือกตอนค้นหาหรือจัดกลุ่มงาน</em>}
                </div>
                <p>{rounds.filter((round) => round.status === "draft").length} รอบกำลังกรอก · {rounds.filter((round) => round.status === "closed").length} ประวัติปิดแล้ว</p>
              </div>
            </div>
            <div className="ops-station-directory-actions">
              {isReady && <Button href={`#/inspections/new?stationId=${encodeURIComponent(profile.id)}`} variant="primary" icon="refresh">เริ่มรอบตรวจ</Button>}
              <Button href={workspaceHref} variant={isReady ? "secondary" : "primary"} icon={assignments.length > 1 ? "archive" : "arrow"}>{assignments.length > 1 ? "เลือกบริบท" : "เปิด Workspace"}</Button>
            </div>
          </article>;
        })}</div> : <EmptyState icon="search" title="ไม่พบสถานีตามตัวกรอง" action={<Button onClick={resetFilters} variant="secondary" icon="refresh">ล้างตัวกรอง</Button>}>ลองเปลี่ยนสัญญา งวด ภาค จังหวัด หรือสถานะ แล้วค้นหาใหม่</EmptyState>}
      </section>
    </section>;
  };
}
