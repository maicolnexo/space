  document.getElementById("prog-save").addEventListener("click", function () {
    if (!auth.currentUser || !currentMonday) return;
    asignaciones = readAsignacionesFromDom();
    sortAsignacionesBySede(asignaciones);
    var panelPrincipal = document.getElementById("panel-principal");
    if (panelPrincipal && !panelPrincipal.hidden) {
      rows = readRowsFromDom();
      sortRowsBySede(rows);
    } else {
      rows = asignacionesToLegacyRows(asignaciones);
    }
    sheetInactividades = document.getElementById("prog-ta-inactividades").value;
    sheetNoche = document.getElementById("prog-ta-noche").value;
    sheetAutorizados = document.getElementById("prog-ta-autorizados").value;
    var key = formatKeyMonday(currentMonday);
    var payload = {
      weekKey: key,
      weekLabel: weekRangeLabel(currentMonday),
      dayHeaders: dayHeadersForMonday(currentMonday),
      asignaciones: asignaciones,
      rows: rows,
      sheetInactividades: sheetInactividades,
      sheetNoche: sheetNoche,
      sheetAutorizados: sheetAutorizados,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    setStatus("Guardando…");
    var diasCal = buildDiasCalendarioFromAsignaciones(
      currentMonday,
      asignaciones,
      key,
      payload.weekLabel
    );
    var batch = db.batch();
    batch.set(db.collection(COL).doc(key), payload, { merge: true });
    Object.keys(diasCal).forEach(function (dateKey) {
      batch.set(db.collection(COL_DIAS).doc(dateKey), diasCal[dateKey], {
        merge: true,
      });
    });
    batch
      .commit()
      .then(function () {
        setStatus(
          "Guardado · semana " +
            key +
            " · calendario " +
            Object.keys(diasCal).length +
            " día(s) · " +
            new Date().toLocaleString("es-CO")
        );
      })
      .catch(function (e) {
        setStatus("Error al guardar: " + (e.code || "") + " " + (e.message || e));
      });
  });

  auth.onAuthStateChanged(function (user) {