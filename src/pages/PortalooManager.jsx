import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import Modal from "react-modal";
import Timeline from "react-calendar-timeline";
import moment from "moment";
import "react-calendar-timeline/lib/Timeline.css";

Modal.setAppElement("#root");

export default function PortalooManager() {
  const [portaloos, setPortaloos] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showGantt, setShowGantt] = useState(false);
  const [selectedPortaloo, setSelectedPortaloo] = useState(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [bookingDates, setBookingDates] = useState({ start: "", end: "" });

  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  useEffect(() => {
    fetchPortaloos();
    fetchBookings();
  }, []);

  const fetchPortaloos = async () => {
    const { data } = await supabase
      .from("portaloo_inventory")
      .select("*")
      .order("portaloo_number");
    setPortaloos(data);
  };

  const fetchBookings = async () => {
    const { data } = await supabase.from("portaloo_bookings").select("*");
    setBookings(data);
  };

  const openBookingModal = (portaloo) => {
    setSelectedPortaloo(portaloo);
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedPortaloo(null);
    setBookingDates({ start: "", end: "" });
  };

  const submitBooking = async () => {
    const { portaloo_number, color } = selectedPortaloo;
    const { start, end } = bookingDates;

    const { error } = await supabase.from("portaloo_bookings").insert({
      portaloo_number,
      color,
      booking_start: start,
      booking_end: end || null,
    });

    if (error) {
      alert("Booking error: " + error.message);
    } else {
      fetchBookings();
      closeModal();
    }
  };

  const toggleView = () => setShowGantt(!showGantt);

  const getTimelineData = () => {
    const groups = portaloos.map((p) => ({
      id: p.portaloo_number,
      title: `#${p.portaloo_number}`,
    }));
    const items = bookings.map((b) => ({
      id: b.id,
      group: b.portaloo_number,
      title: `${b.color}`,
      start_time: moment(b.booking_start),
      end_time: b.booking_end
        ? moment(b.booking_end)
        : moment(b.booking_start).add(30, "days"),
    }));
    return { groups, items };
  };

  return (
    <div className="p-4">
      {/* Breadcrumb + Logout */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => navigate("/admin")}
          className="text-sm underline text-blue-600 hover:text-blue-800"
        >
          ← Back to Admin Dashboard
        </button>
        <button onClick={handleLogout} className="btn-bubbly px-4 py-1 text-sm">
          Log Out
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-4">Portaloo Manager</h1>
      <button
        onClick={toggleView}
        className="mb-4 bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded"
      >
        {showGantt ? "View Inventory List" : "View Gantt Timeline"}
      </button>

      {showGantt ? (
        <div className="h-[600px] border rounded bg-white">
          <Timeline
            groups={getTimelineData().groups}
            items={getTimelineData().items}
            defaultTimeStart={moment().add(-1, "day")}
            defaultTimeEnd={moment().add(30, "days")}
            canMove={false}
            canResize={false}
            stackItems
            itemHeightRatio={0.8}
          />
        </div>
      ) : (
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="py-2 px-3">Number</th>
              <th className="py-2 px-3">Color</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {portaloos.map((p) => (
              <tr
                key={p.portaloo_number}
                className={
                  p.status === "Rented"
                    ? "bg-red-100"
                    : p.status === "Out of Order"
                    ? "bg-yellow-100"
                    : "bg-green-100"
                }
              >
                <td className="text-center py-1">{p.portaloo_number}</td>
                <td className="text-center">{p.color}</td>
                <td className="text-center">{p.status}</td>
                <td className="text-center">
                  <button
                    onClick={() => openBookingModal(p)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                  >
                    Book
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Booking Modal */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Book Portaloo"
        className="bg-white p-6 rounded-lg max-w-md mx-auto mt-20"
        overlayClassName="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-start z-50"
      >
        <h2 className="text-xl mb-2">
          Book Portaloo #{selectedPortaloo?.portaloo_number}
        </h2>
        <label>Start Date:</label>
        <input
          type="date"
          value={bookingDates.start}
          onChange={(e) =>
            setBookingDates({ ...bookingDates, start: e.target.value })
          }
          className="block mb-2 w-full border px-2 py-1"
        />
        <label>End Date (optional):</label>
        <input
          type="date"
          value={bookingDates.end}
          onChange={(e) =>
            setBookingDates({ ...bookingDates, end: e.target.value })
          }
          className="block mb-2 w-full border px-2 py-1"
        />
        <div className="flex gap-4 mt-4">
          <button
            onClick={submitBooking}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Submit
          </button>
          <button
            onClick={closeModal}
            className="bg-gray-400 text-white px-4 py-2 rounded"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
