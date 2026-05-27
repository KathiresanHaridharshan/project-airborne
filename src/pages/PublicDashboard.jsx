import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Trophy, Phone, FileText, CheckCircle2, Users, Award, Radio } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PublicDashboard() {
  const [teams, setTeams] = useState([]);
  const [leads, setLeads] = useState([]);
  const [manualScores, setManualScores] = useState({});
  const [pointsConfig, setPointsConfig] = useState({
    approval: 200,
    application: 75,
    virtualMeetings: 5,
    ogxSignUps: 1,
    digitalCampaigns: 5,
    physicalCampaigns: 20,
    physicalAttendance: 5
  });
  const [loading, setLoading] = useState(true);

  // Countdown timer calculation
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const targetDate = new Date('2026-06-30T23:59:59').getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;
      if (difference <= 0) {
        setTimeLeft('Competition Ended');
        clearInterval(interval);
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${days}d ${hours}h ${minutes}m remaining`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to Firestore real-time updates
  useEffect(() => {
    setLoading(true);

    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teamsList = [];
      snapshot.forEach((doc) => {
        teamsList.push({ id: doc.id, ...doc.data() });
      });
      setTeams(teamsList);
    }, (error) => {
      console.error("Teams listener error:", error);
    });

    const unsubLeads = onSnapshot(collection(db, 'leads'), (snapshot) => {
      const leadsList = [];
      snapshot.forEach((doc) => {
        leadsList.push({ id: doc.id, ...doc.data() });
      });
      setLeads(leadsList);
    }, (error) => {
      console.error("Leads listener error:", error);
    });

    const unsubManual = onSnapshot(collection(db, 'manualScores'), (snapshot) => {
      const manualObj = {};
      snapshot.forEach((doc) => {
        manualObj[doc.id] = doc.data();
      });
      setManualScores(manualObj);
    }, (error) => {
      console.error("Manual scores listener error:", error);
    });

    const unsubPoints = onSnapshot(doc(db, 'pointsConfig', 'default'), (docSnap) => {
      if (docSnap.exists()) {
        setPointsConfig(docSnap.data());
      }
    }, (error) => {
      console.error("Points config listener error:", error);
    });

    // Wait a brief moment to ensure records load
    const timer = setTimeout(() => setLoading(false), 800);

    return () => {
      unsubTeams();
      unsubLeads();
      unsubManual();
      unsubPoints();
      clearTimeout(timer);
    };
  }, []);

  // Calculate Scores & Metrics per Team
  const teamScores = teams.map((team) => {
    // Filter leads belonging to this team
    const teamLeads = leads.filter(l => l.allocatedTeam === team.id || l.allocatedTeam === team.name);

    // Call count (status is anything other than '—' or empty)
    const callsCount = teamLeads.filter(l => l.status && l.status !== '—').length;

    // Applications pending approval
    const pendingApps = teamLeads.filter(l => l.status === 'Applied' && !l.adminApproved).length;

    // Admin-approved Applications
    const approvedApps = teamLeads.filter(l => l.status === 'Applied' && l.adminApproved).length;

    // Admin-approved Approvals
    const approvedApprovals = teamLeads.filter(l => l.status === 'Approved' && l.adminApproved).length;

    // Fetch manual scores for this team
    const ms = manualScores[team.id] || {
      virtualMeetings: 0,
      ogxSignUps: 0,
      digitalCampaigns: 0,
      physicalCampaigns: 0,
      physicalAttendance: 0,
      innovationsScore: 0
    };

    // Points calculation
    const approvalPointsTotal = approvedApprovals * (pointsConfig.approval || 200);
    const applicationPointsTotal = approvedApps * (pointsConfig.application || 75);
    const virtualMeetingPointsTotal = (ms.virtualMeetings || 0) * (pointsConfig.virtualMeetings || 5);
    const ogxPointsTotal = (ms.ogxSignUps || 0) * (pointsConfig.ogxSignUps || 1);
    const digitalCampaignPointsTotal = (ms.digitalCampaigns || 0) * (pointsConfig.digitalCampaigns || 5);
    const physicalCampaignPointsTotal = (ms.physicalCampaigns || 0) * (pointsConfig.physicalCampaigns || 20);
    const physicalAttendancePointsTotal = (ms.physicalAttendance || 0) * (pointsConfig.physicalAttendance || 5);
    const innovationsScore = ms.innovationsScore || 0;

    const totalScore = 
      approvalPointsTotal +
      applicationPointsTotal +
      virtualMeetingPointsTotal +
      ogxPointsTotal +
      digitalCampaignPointsTotal +
      physicalCampaignPointsTotal +
      physicalAttendancePointsTotal +
      innovationsScore;

    return {
      ...team,
      callsCount,
      pendingApps,
      approvedApps,
      approvedApprovals,
      approvalPoints: approvalPointsTotal,
      applicationPoints: applicationPointsTotal,
      manualPoints: 
        virtualMeetingPointsTotal + 
        ogxPointsTotal + 
        digitalCampaignPointsTotal + 
        physicalCampaignPointsTotal + 
        physicalAttendancePointsTotal + 
        innovationsScore,
      totalScore
    };
  });

  // Sort teams by totalScore descending
  const sortedTeams = [...teamScores].sort((a, b) => b.totalScore - a.totalScore);

  // Top 3 Teams for Podium
  const podiumTeams = [
    sortedTeams[0] || null, // 1st Place
    sortedTeams[1] || null, // 2nd Place
    sortedTeams[2] || null  // 3rd Place
  ];

  // Highest team score for horizontal list progress bar calculation
  const topTeamScore = sortedTeams[0]?.totalScore || 1;

  // Calculate Individual Leaderboard
  // Individual Score = (Approved approvals * 200) + (Approved applications * 75)
  const individualScores = [];
  teams.forEach(team => {
    if (team.members && Array.isArray(team.members)) {
      team.members.forEach(member => {
        // Find leads for this specific team member that are admin-approved
        const memberLeads = leads.filter(l => 
          (l.allocatedTeam === team.id || l.allocatedTeam === team.name) && 
          l.approachedBy === member && 
          l.adminApproved
        );

        const apps = memberLeads.filter(l => l.status === 'Applied').length;
        const approvals = memberLeads.filter(l => l.status === 'Approved').length;

        const score = (approvals * (pointsConfig.approval || 200)) + (apps * (pointsConfig.application || 75));

        individualScores.push({
          name: member,
          teamName: team.name,
          applications: apps,
          approvals,
          score
        });
      });
    }
  });

  // Sort individuals
  const sortedIndividuals = [...individualScores].sort((a, b) => b.score - a.score).slice(0, 10);

  // Global totals for Stats Bar
  const globalCalls = teamScores.reduce((sum, t) => sum + t.callsCount, 0);
  const globalApplications = leads.filter(l => l.status === 'Applied').length;
  const globalApprovals = leads.filter(l => l.status === 'Approved' && l.adminApproved).length;
  const globalTeamsCount = teams.length;

  // Chart Data preparation
  const chartData = sortedTeams.map(t => ({
    name: t.name,
    'Approvals Pts': t.approvalPoints,
    'Applications Pts': t.applicationPoints,
    'Other Pts': t.manualPoints
  }));

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '80vh',
        gap: '1rem'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #16161c',
          borderTopColor: '#f85a3f',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontFamily: 'Space Grotesk', color: '#9a9ab0', fontSize: '1.1rem' }}>
          Loading Competition Feed...
        </p>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-container">
          <div className="logo-container">
            <div className="logo-badge">A</div>
            <div className="logo-text">PROJECT <span className="logo-accent">AIRBORNE</span></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="badge badge-live">
              <Radio size={14} style={{ marginRight: '2px' }} /> LIVE
            </span>
            {timeLeft && (
              <span style={{ 
                fontFamily: 'Space Grotesk', 
                fontSize: '0.85rem', 
                color: '#fff', 
                backgroundColor: 'rgba(255,255,255,0.05)',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--color-border)'
              }}>
                {timeLeft}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="main-content animate-fade-in">
        {/* Full-screen Hero Section */}
        <section style={{
          textAlign: 'center',
          padding: '4rem 1rem',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '24px',
          background: 'radial-gradient(circle at center, rgba(248, 90, 63, 0.08) 0%, transparent 70%)',
          marginBottom: '3rem',
          border: '1px dashed rgba(248, 90, 63, 0.15)'
        }}>
          <h1 style={{ 
            fontSize: 'calc(1.8rem + 2.5vw)', 
            marginBottom: '1rem', 
            background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f7 50%, #f85a3f 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em'
          }}>
            PROJECT AIRBORNE
          </h1>
          <p style={{
            fontSize: '1.2rem',
            color: 'var(--color-text-secondary)',
            maxWidth: '650px',
            margin: '0 auto 1.5rem auto',
            fontWeight: '400'
          }}>
            Outreach. Innovation. Conversion. The battle of the ultimate sales outreach titans.
          </p>
          <div style={{ display: 'inline-flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="badge badge-live" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              🎯 Arena Status: Active
            </span>
          </div>
        </section>

        {/* SECTION 1 — TEAM PODIUM */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trophy color="#f85a3f" /> LEADERBOARD PODIUM
          </h2>

          {/* Podium Visualization */}
          {sortedTeams.length > 0 ? (
            <div className="podium-container">
              {/* 2nd Place */}
              {podiumTeams[1] && (
                <div className="podium-block rank-2">
                  <div className="podium-team-name">{podiumTeams[1].name}</div>
                  <div className="podium-score">{podiumTeams[1].totalScore} pts</div>
                  <div className="podium-base">
                    <span className="podium-medal">🥈</span>
                    <span className="podium-rank-num">#2</span>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {podiumTeams[0] && (
                <div className="podium-block rank-1">
                  <div className="podium-team-name">{podiumTeams[0].name}</div>
                  <div className="podium-score">{podiumTeams[0].totalScore} pts</div>
                  <div className="podium-base">
                    <span className="podium-medal">🥇</span>
                    <span className="podium-rank-num">#1</span>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {podiumTeams[2] && (
                <div className="podium-block rank-3">
                  <div className="podium-team-name">{podiumTeams[2].name}</div>
                  <div className="podium-score">{podiumTeams[2].totalScore} pts</div>
                  <div className="podium-base">
                    <span className="podium-medal">🥉</span>
                    <span className="podium-rank-num">#3</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
              No teams registered yet.
            </div>
          )}

          {/* Full ranked list below podium */}
          <div className="card" style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'white' }}>Ranked Standings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {sortedTeams.map((team, idx) => {
                const percentage = Math.max(10, Math.min(100, (team.totalScore / topTeamScore) * 100));
                let rankIcon = `#${idx + 1}`;
                if (idx === 0) rankIcon = '🥇';
                if (idx === 1) rankIcon = '🥈';
                if (idx === 2) rankIcon = '🥉';

                return (
                  <div key={team.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '50px 1fr auto',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <div style={{ 
                      fontFamily: 'Space Grotesk', 
                      fontWeight: '700', 
                      fontSize: idx < 3 ? '1.3rem' : '1rem',
                      color: idx === 0 ? '#fbbf24' : idx === 1 ? '#9ca3af' : idx === 2 ? '#b45309' : '#8e8e93',
                      textAlign: 'center'
                    }}>
                      {rankIcon}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontWeight: '600', color: 'white' }}>{team.name}</span>
                      {/* Custom horizontal progress bar relative to the leader */}
                      <div style={{ 
                        height: '6px', 
                        width: '100%', 
                        backgroundColor: '#1c1c24', 
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${percentage}%`, 
                          background: 'linear-gradient(90deg, #f85a3f, #ff7d66)',
                          borderRadius: '3px',
                          transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)'
                        }} />
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: '700', fontSize: '1.1rem', color: '#fff', textAlign: 'right' }}>
                      {team.totalScore} <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: '400' }}>pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 4 — COMPETITION STATS STRIP */}
        <section style={{ marginBottom: '4rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.5rem',
            padding: '2rem 1.5rem',
            background: 'linear-gradient(135deg, #111115 0%, #16161c 100%)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }} className="animate-glow">
            <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: '#f85a3f', marginBottom: '0.5rem' }}>
                <Phone size={24} />
              </div>
              <div style={{ fontSize: '1.75rem', fontFamily: 'Space Grotesk', fontWeight: '700' }}>{globalCalls}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Total Calls Made</div>
            </div>
            <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: '#ff7d66', marginBottom: '0.5rem' }}>
                <FileText size={24} />
              </div>
              <div style={{ fontSize: '1.75rem', fontFamily: 'Space Grotesk', fontWeight: '700' }}>{globalApplications}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Total Applications</div>
            </div>
            <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: '#10b981', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={24} />
              </div>
              <div style={{ fontSize: '1.75rem', fontFamily: 'Space Grotesk', fontWeight: '700' }}>{globalApprovals}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Total Approvals</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: '#9a9ab0', marginBottom: '0.5rem' }}>
                <Users size={24} />
              </div>
              <div style={{ fontSize: '1.75rem', fontFamily: 'Space Grotesk', fontWeight: '700' }}>{globalTeamsCount}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Active Teams</div>
            </div>
          </div>
        </section>

        {/* SECTION 2 — TEAM STATS CARDS */}
        <section style={{ marginBottom: '4rem' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users color="#f85a3f" /> TEAM PERFORMANCE MATRICES
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem'
          }}>
            {teamScores.map((team) => (
              <div key={team.id} className="card">
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  paddingBottom: '0.75rem'
                }}>
                  <h3 style={{ fontSize: '1.15rem', color: 'white', fontWeight: '600' }}>{team.name}</h3>
                  <span className="badge badge-neutral">{team.type}</span>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1.25rem'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>CALLS MADE</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', fontFamily: 'Space Grotesk' }}>{team.callsCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>PENDING APPS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', fontFamily: 'Space Grotesk', color: '#f59e0b' }}>{team.pendingApps}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>APPROVED APPS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', fontFamily: 'Space Grotesk' }}>{team.approvedApps}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>APPROVALS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', fontFamily: 'Space Grotesk', color: '#10b981' }}>{team.approvedApprovals}</div>
                  </div>
                </div>
                <div style={{
                  backgroundColor: 'rgba(248, 90, 63, 0.05)',
                  border: '1px solid rgba(248, 90, 63, 0.1)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: '500' }}>TOTAL TEAM SCORE</span>
                  <span style={{ 
                    fontFamily: 'Space Grotesk', 
                    fontSize: '1.4rem', 
                    fontWeight: '700', 
                    color: 'var(--color-primary)' 
                  }}>
                    {team.totalScore}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '2.5rem',
          marginBottom: '4rem'
        }}>
          {/* SECTION 5 — SCORE BREAKDOWN CHART */}
          <section className="card" style={{ overflow: 'visible' }}>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
              <Award color="#f85a3f" /> SCORE BREAKDOWN
            </h2>
            {chartData.length > 0 ? (
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#22222d" />
                    <XAxis dataKey="name" stroke="#8e8e93" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#8e8e93" tick={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111115', borderColor: '#22222d', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Bar dataKey="Approvals Pts" stackId="a" fill="#10b981" />
                    <Bar dataKey="Applications Pts" stackId="a" fill="#fbbf24" />
                    <Bar dataKey="Other Pts" stackId="a" fill="#f85a3f" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
                No performance data to display in chart.
              </div>
            )}
          </section>

          {/* SECTION 3 — INDIVIDUAL TOP PERFORMERS */}
          <section className="card">
            <h2 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
              <Award color="#f85a3f" /> INDIVIDUAL TOP PERFORMERS
            </h2>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Team</th>
                    <th>Applications</th>
                    <th>Approvals</th>
                    <th>Calculated Score</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedIndividuals.length > 0 ? (
                    sortedIndividuals.map((ind, index) => {
                      let rowClass = "";
                      if (index === 0) rowClass = "highlighted-gold";
                      else if (index === 1) rowClass = "highlighted-silver";
                      else if (index === 2) rowClass = "highlighted-bronze";

                      return (
                        <tr key={index} className={rowClass}>
                          <td style={{ fontWeight: '700' }}>
                            {index === 0 ? '🥇 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `#${index + 1}`}
                          </td>
                          <td style={{ fontWeight: '600' }}>{ind.name}</td>
                          <td>{ind.teamName}</td>
                          <td>{ind.applications}</td>
                          <td>{ind.approvals}</td>
                          <td style={{ 
                            fontFamily: 'Space Grotesk', 
                            fontWeight: '700', 
                            color: index < 3 ? 'inherit' : 'var(--color-primary)' 
                          }}>
                            {ind.score}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem' }}>
                        No individual logs recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--color-border)',
        padding: '1.5rem 2rem',
        textAlign: 'center',
        color: 'var(--color-text-secondary)',
        fontSize: '0.85rem'
      }}>
        Project Airborne &copy; 2026. All rights reserved. Real-time Arena synced.
      </footer>
    </div>
  );
}
