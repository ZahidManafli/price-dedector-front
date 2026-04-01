import React from 'react';
import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6 md:p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">About Price Check App</h1>

        <div className="space-y-5 text-gray-700 leading-7">
          <p>
            Price Check App helps online sellers track Amazon and eBay prices, estimate profit, and
            react quickly when costs change.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">What We Do</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Track Amazon product price changes</li>
              <li>Calculate profit using your configured formula</li>
              <li>Store price history for each product</li>
              <li>Send notifications when important changes happen</li>
              <li>Optionally sync recommended prices to connected eBay listings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Contact</h2>
            <p>Support email: pricededector@gmail.com</p>
          </section>
        </div>

        <div className="mt-8">
          <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
            Back to app
          </Link>
        </div>
      </div>
    </div>
  );
}

