import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/admin/dashboard`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setStats(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!stats) return <div>No data available</div>;

  return (
    <div className="dashboard">
      <h1>Admin Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Venues</h3>
          <p className="stat-number">{stats.totalVenues || 0}</p>
        </div>
        
        <div className="stat-card">
          <h3>Active Screens</h3>
          <p className="stat-number">{stats.activeScreens || 0}</p>
        </div>
        
        <div className="stat-card">
          <h3>Total Advertisers</h3>
          <p className="stat-number">{stats.totalAdvertisers || 0}</p>
        </div>
        
        <div className="stat-card">
          <h3>Active Campaigns</h3>
          <p cla
